import { describe, expect, it } from "vitest";
import { OutboxPublisher, type OutboxEvent, type OutboxStore } from "@bgo/commercial";

/**
 * G71 — OutboxPublisher: entrega at-least-once, retry com backoff,
 * baseline sem replay, falha entre emit e mark gera reentrega.
 */
function makeStore(events: OutboxEvent[]) {
  const published = new Set<string>();
  const store: OutboxStore & { published: Set<string> } = {
    published,
    async listUnpublishedEvents(limit = 100) {
      return events.filter((e) => !published.has(e.eventId)).slice(0, limit);
    },
    async markEventPublished(eventId: string) {
      published.add(eventId);
    },
  };
  return store;
}

const ev = (id: string, occurredAt = "2026-01-01T00:00:00.000Z"): OutboxEvent => ({
  eventId: id, eventType: "mission.created.v1", version: 1,
  workspaceId: "birthub-growth", correlationId: `c-${id}`,
  occurredAt, payload: {}, 
});

describe("OutboxPublisher (G71)", () => {
  it("baseline marca eventos antigos sem reemitir; novos são entregues", async () => {
    const store = makeStore([ev("old-1"), ev("new-1", "2026-06-01T00:00:00.000Z")]);
    const emitted: string[] = [];
    const pub = new OutboxPublisher(store, (e) => { emitted.push(e.eventId); }, {
      baselineCutoff: "2026-03-01T00:00:00.000Z",
    });
    await pub.baseline();
    expect(store.published.has("old-1")).toBe(true);
    expect(emitted).toHaveLength(0);
    await pub.drainOnce();
    expect(emitted).toEqual(["new-1"]);
    expect(store.published.has("new-1")).toBe(true);
  });

  it("falha no emit NÃO marca; retenta com backoff exponencial", async () => {
    const store = makeStore([ev("f1", "2026-06-01T00:00:00.000Z")]);
    let calls = 0;
    const pub = new OutboxPublisher(store, () => {
      calls++;
      if (calls === 1) throw new Error("SSE indisponível");
    }, { baselineCutoff: "2026-03-01T00:00:00.000Z" });
    const t0 = Date.now();
    await pub.drainOnce(t0);
    expect(store.published.size).toBe(0);
    expect(pub.metricsSnapshot().retried).toBe(1);
    // backoff de 1s — drain imediato não retenta
    await pub.drainOnce(t0 + 500);
    expect(calls).toBe(1);
    // após backoff, retenta e publica
    await pub.drainOnce(t0 + 1500);
    expect(calls).toBe(2);
    expect(store.published.has("f1")).toBe(true);
    expect(pub.metricsSnapshot().published).toBe(1);
  });

  it("falha no mark após emit gera reentrega (at-least-once)", async () => {
    const events = [ev("m1", "2026-06-01T00:00:00.000Z")];
    const published = new Set<string>();
    let markCalls = 0;
    const flakyStore: OutboxStore = {
      async listUnpublishedEvents() { return events.filter((e) => !published.has(e.eventId)); },
      async markEventPublished(id: string) {
        markCalls++;
        if (markCalls === 1) throw new Error("db timeout"); // primeira falha
        published.add(id);
      },
    };
    const emitted: string[] = [];
    const pub = new OutboxPublisher(flakyStore, (e) => { emitted.push(e.eventId); }, {
      baselineCutoff: "2026-03-01T00:00:00.000Z",
    });
    await pub.drainOnce();
    expect(emitted).toEqual(["m1"]);
    expect(published.size).toBe(0); // mark falhou → continua pendente
    await pub.drainOnce(Date.now() + 2000);
    expect(emitted).toEqual(["m1", "m1"]); // reemitido — duplicata esperada
    expect(published.has("m1")).toBe(true);
  });

  it("métricas refletem published/retried/failed", async () => {
    const store = makeStore([ev("x1", "2026-06-01T00:00:00.000Z"), ev("x2", "2026-06-01T00:00:00.000Z")]);
    let n = 0;
    const pub = new OutboxPublisher(store, (e) => {
      n++;
      if (e.eventId === "x1" && n <= 9) throw new Error("sempre falha");
    }, { baselineCutoff: "2026-03-01T00:00:00.000Z", maxAttempts: 3 });
    const t = Date.now();
    await pub.drainOnce(t);                    // x1 falha (1), x2 publica
    await pub.drainOnce(t + 2000);             // x1 falha (2)
    await pub.drainOnce(t + 5000);             // x1 falha (3) → failed
    const m = pub.metricsSnapshot();
    expect(m.published).toBe(1);
    expect(m.retried).toBeGreaterThanOrEqual(3);
    expect(m.failed).toBeGreaterThanOrEqual(1);
  });

  it("stop() faz batida final controlada", async () => {
    const store = makeStore([ev("s1", "2026-06-01T00:00:00.000Z")]);
    const pub = new OutboxPublisher(store, () => {}, { baselineCutoff: "2026-03-01T00:00:00.000Z" });
    await pub.stop();
    expect(store.published.has("s1")).toBe(true);
  });
});
