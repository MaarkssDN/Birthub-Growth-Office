import { describe, expect, it } from "vitest";
import { LocalQueue } from "@bgo/worker";

describe("fila local (semântica BullMQ)", () => {
  it("idempotencyKey impede duplicados", async () => {
    const q = new LocalQueue();
    let ran = 0;
    q.register("job", () => { ran += 1; });
    q.enqueue("job", { a: 1 }, { idempotencyKey: "k1" });
    q.enqueue("job", { a: 1 }, { idempotencyKey: "k1" });
    await q.tick();
    expect(ran).toBe(1);
  });

  it("retry com backoff e DLQ após maxAttempts", async () => {
    const q = new LocalQueue();
    let attempts = 0;
    q.register("fail", () => {
      attempts += 1;
      throw new Error("boom");
    });
    q.enqueue("fail", {}, { idempotencyKey: "f1", maxAttempts: 2 });
    await q.tick();
    expect(attempts).toBe(1);
    const job = q.list()[0]!;
    expect(job.status).toBe("queued"); // reagendado com backoff
    job.runAt = 0; // força vencimento
    await q.tick();
    expect(attempts).toBe(2);
    expect(q.list()[0]!.status).toBe("dead");
    expect(q.deadLetter).toHaveLength(1);
  });

  it("pausa impede processamento", async () => {
    const q = new LocalQueue();
    let ran = 0;
    q.register("job", () => { ran += 1; });
    q.enqueue("job", {}, { idempotencyKey: "p1" });
    q.pause();
    await q.tick();
    expect(ran).toBe(0);
    q.resume();
    await q.tick();
    expect(ran).toBe(1);
  });
});
