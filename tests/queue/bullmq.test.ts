import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { RedisMemoryServer } from "redis-memory-server";
import { PersistentQueue } from "@bgo/worker";

let redis: RedisMemoryServer;
let redisUrl: string;

beforeAll(async () => {
  redis = new RedisMemoryServer({ instance: { port: 6390, ip: "127.0.0.1" } });
  await redis.start();
  redisUrl = `redis://127.0.0.1:${await redis.getPort()}`;
}, 60000);

afterAll(async () => {
  await redis.stop();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => Promise<boolean> | boolean, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return true;
    await sleep(150);
  }
  return false;
}

describe("fila persistente BullMQ (G22)", () => {
  it("job enfileirado é processado e concluído", async () => {
    const q = new PersistentQueue(redisUrl);
    let ran = 0;
    q.register("t1", () => { ran += 1; });
    q.startWorker(1);
    await q.enqueue("t1", { x: 1 }, { idempotencyKey: "k-basic" });
    expect(await waitFor(() => ran === 1)).toBe(true);
    const c = await q.counts();
    expect(c.main.completed).toBeGreaterThanOrEqual(1);
    await q.close();
  });

  it("idempotência: mesma key não executa duas vezes", async () => {
    const q = new PersistentQueue(redisUrl);
    let ran = 0;
    q.register("t2", () => { ran += 1; });
    q.startWorker(1);
    const a = await q.enqueue("t2", { x: 2 }, { idempotencyKey: "k-idem" });
    const b = await q.enqueue("t2", { x: 2 }, { idempotencyKey: "k-idem" });
    expect(a.deduplicated || b.deduplicated).toBe(true);
    await waitFor(async () => (await q.counts()).main.completed! >= 1, 15000);
    await sleep(500);
    expect(ran).toBe(1);
    await q.close();
  });

  it("falha esgota retries e cai na DLQ", async () => {
    const q = new PersistentQueue(redisUrl);
    let attempts = 0;
    q.register("t3", () => { attempts += 1; throw new Error("falha proposital"); });
    q.startWorker(1);
    await q.enqueue("t3", {}, { idempotencyKey: "k-dlq", maxAttempts: 2 });
    const dlqReady = await waitFor(async () => (await q.counts()).dlq.waiting! >= 1, 25000);
    expect(dlqReady).toBe(true);
    expect(attempts).toBe(2);
    await q.close();
  });

  it("job pendente sobrevive a restart do worker e é retomado", async () => {
    // fila A enfileira mas NÃO consome
    const producer = new PersistentQueue(redisUrl);
    await producer.enqueue("t4", { resume: true }, { idempotencyKey: "k-restart" });

    // worker 1: registra handler mas fecha antes de processar (simula crash)
    const w1 = new PersistentQueue(redisUrl);
    w1.register("t4", () => { throw new Error("não deve rodar aqui"); });
    // não chama startWorker → job fica waiting no Redis
    await w1.close();
    await producer.close();

    // worker 2 ("restart"): consome o job pendente
    const w2 = new PersistentQueue(redisUrl);
    let ran = 0;
    w2.register("t4", () => { ran += 1; });
    w2.startWorker(1);
    expect(await waitFor(() => ran === 1, 15000)).toBe(true);
    await w2.close();
  });

  it("pausa e retomada funcionam", async () => {
    const q = new PersistentQueue(redisUrl);
    let ran = 0;
    q.register("t5", () => { ran += 1; });
    q.startWorker(1);
    await q.pause();
    await q.enqueue("t5", {}, { idempotencyKey: "k-pause" });
    await sleep(1500);
    expect(ran).toBe(0);
    await q.resume();
    expect(await waitFor(() => ran === 1, 15000)).toBe(true);
    await q.close();
  });
});
