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
  const pg = await startPglite(mkdtempSync(join(tmpdir(), "bgo-test-pg-")));
  process.env.DATABASE_URL = databaseUrlFor();
  // aplica a migration versionada direto na instância PGlite (idempotente não é;
  // dataDir é temporário, então sempre fresco)
  const sql = readFileSync("prisma/migrations/20250101000000_init_onda01/migration.sql", "utf-8");
  await pg.db.exec(sql);
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
});
