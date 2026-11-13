import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisMemoryServer } from "redis-memory-server";
import { startPglite, stopPglite, databaseUrlFor, PrismaStore, disconnectPrisma } from "@bgo/db";
import { createWorker, PersistentQueue, type StorePort } from "@bgo/worker";

let redis: RedisMemoryServer;
let redisUrl: string;
let store: PrismaStore;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => Promise<boolean> | boolean, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return true;
    await sleep(200);
  }
  return false;
}

beforeAll(async () => {
  // porta dedicada: 5437 pode estar ocupada pelo Postgres nativo (Onda 04)
  const TEST_PG_PORT = 5441;
  const pg = await startPglite(mkdtempSync(join(tmpdir(), "bgo-test-pg-")), TEST_PG_PORT);
  process.env.DATABASE_URL = databaseUrlFor(TEST_PG_PORT);
  // aplica as migrations versionadas direto na instância PGlite
  const sql01 = readFileSync("prisma/migrations/20250101000000_init_onda01/migration.sql", "utf-8");
  const sql10 = readFileSync("prisma/migrations/20261113000000_onda10_scout_costs/migration.sql", "utf-8");
  const sql11 = readFileSync("prisma/migrations/20261113183000_onda11_commercial_pipeline/migration.sql", "utf-8");
  await pg.db.exec(sql01);
  await pg.db.exec(sql10);
  await pg.db.exec(sql11);
  store = new PrismaStore();
  await store.init();
  redis = new RedisMemoryServer({ instance: { port: 6391, ip: "127.0.0.1" } });
  await redis.start();
  redisUrl = `redis://127.0.0.1:${await redis.getPort()}`;
}, 120000);

afterAll(async () => {
  await redis.stop().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
  await stopPglite().catch(() => undefined);
});

describe("worker persistente (G31/G32)", () => {
  it("demo-flow via BullMQ persiste missão, eventos outbox e sobrevive a restart do worker", async () => {
    const cid = `e2e-worker-${Date.now()}`;
    const { queue: q1, backend } = await createWorker(store as StorePort, { redisUrl });
    expect(backend).toBe("bullmq");
    expect((q1 as PersistentQueue).name).toBe("bgo-jobs");

    await (q1 as PersistentQueue).enqueue("demo-flow", { correlationId: cid }, { idempotencyKey: `job-${cid}` });

    const done = await waitFor(async () => {
      const missions = await store.listMissions();
      return missions.some((m) => m.correlationId === cid && m.status === "awaiting_approval");
    });
    expect(done).toBe(true);

    // eventos persistidos no outbox (prova do fix de persistEvent no orquestrador)
    const events = await (store as unknown as { listPersistedEvents(f: object): Promise<unknown[]> })
      .listPersistedEvents({ correlationId: cid, limit: 100 });
    expect(events.length).toBeGreaterThan(5);

    // idempotência de domínio: re-enfileirar mesmo correlationId não duplica missão
    await (q1 as PersistentQueue).enqueue("demo-flow", { correlationId: cid }, { idempotencyKey: `job2-${cid}` });
    await sleep(1500);
    const missions = await store.listMissions();
    expect(missions.filter((m) => m.correlationId === cid).length).toBe(1);

    // "restart": fecha worker/fila e sobe novo consumidor no mesmo Redis+DB
    await q1.close();
    const cid2 = `e2e-worker2-${Date.now()}`;
    const { queue: q2 } = await createWorker(store as StorePort, { redisUrl });
    await (q2 as PersistentQueue).enqueue("demo-flow", { correlationId: cid2 }, { idempotencyKey: `job-${cid2}` });
    const done2 = await waitFor(async () => {
      const ms = await store.listMissions();
      return ms.some((m) => m.correlationId === cid2);
    });
    expect(done2).toBe(true);
    await q2.close();
  }, 90000);

  it("cancelamento de job pendente funciona", async () => {
    const q = new PersistentQueue(redisUrl);
    q.register("noop", () => undefined);
    q.startWorker(1);
    const key = `cancel-${Date.now()}`;
    await q.enqueue("noop", {}, { idempotencyKey: key, delayMs: 60_000 });
    const removed = await q.cancel(key);
    expect(removed).toBe(true);
    await sleep(500);
    const c = await q.counts();
    expect((c.main.waiting ?? 0) + (c.main.delayed ?? 0)).toBe(0);
    await q.close();
  });

  it("recupera job stalled EM EXECUÇÃO via at-least-once (G32)", async () => {
    // Simula crash: worker pega o job, handler trava, conexão Redis do worker
    // é derrubada (lock expira). Novo worker detecta stalled e reexecuta.
    const key = `stall-${Date.now()}`;
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => (releaseFirst = r));
    let attempts = 0;

    const q1 = new PersistentQueue(redisUrl);
    q1.register("stall-test", async () => {
      attempts += 1;
      if (attempts === 1) await gate; // tentativa 1 fica presa = "crash"
    });
    const w1 = q1.startWorker(1, { lockDurationMs: 2_000, stalledIntervalMs: 1_000, maxStalledCount: 2 });
    await q1.enqueue("stall-test", {}, { idempotencyKey: key, maxAttempts: 1 });
    expect(await waitFor(() => attempts === 1, 15_000)).toBe(true);

    // "morte" do worker: conexões Redis caem, lock do job expira
    await (w1 as unknown as { disconnect(): Promise<void> }).disconnect().catch(() => undefined);
    releaseFirst(); // destrava handler órfão para não vazar no processo

    // novo consumidor: stalled checker move o job de volta para wait e reexecuta
    const q2 = new PersistentQueue(redisUrl);
    q2.register("stall-test", async () => {
      attempts += 1;
    });
    q2.startWorker(1, { lockDurationMs: 2_000, stalledIntervalMs: 1_000, maxStalledCount: 2 });
    const done = await waitFor(() => attempts >= 2, 30_000);
    expect(done).toBe(true);
    await q2.close();
    await q1.close().catch(() => undefined); // worker1 já desconectado
  }, 60_000);

  it("cancelamento cooperativo de job ATIVO via ctx.isCancelled (G32)", async () => {
    const q = new PersistentQueue(redisUrl);
    let ranToEnd = false;
    q.register("coop-test", async (_data, ctx) => {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        if (ctx && (await ctx.isCancelled())) throw new Error("cancelado pelo operador");
        await sleep(100);
      }
      ranToEnd = true;
    });
    q.startWorker(1);
    const key = `coop-${Date.now()}`;
    await q.enqueue("coop-test", {}, { idempotencyKey: key, maxAttempts: 1 });

    // espera o job ficar ativo antes de cancelar
    expect(await waitFor(async () => (await q.counts()).main.active === 1, 15_000)).toBe(true);
    const t0 = Date.now();
    expect(await q.cancel(key)).toBe(true);

    // handler deve abortar cedo via ctx e o job vai para DLQ (auditável)
    const dlq = await waitFor(async () => ((await q.counts()).dlq.failed ?? 0) + ((await q.counts()).dlq.waiting ?? 0) > 0, 15_000);
    expect(dlq).toBe(true);
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(ranToEnd).toBe(false);
    await q.close();
  }, 60_000);
});
