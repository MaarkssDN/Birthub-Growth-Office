import { Store, runDemoFlow, type StorePort } from "@bgo/commercial";
import { LocalQueue } from "./queue";
import { PersistentQueue } from "./persistent-queue";

export { LocalQueue } from "./queue";
export { PersistentQueue } from "./persistent-queue";
export type { Job, JobHandler } from "./queue";

export type QueueBackend = "local" | "bullmq";

/**
 * Resolve conexão Redis:
 * 1. BGO_REDIS_URL definida → usa;
 * 2. BGO_REDIS_EMBEDDED=1 → sobe redis-memory-server embutido em 127.0.0.1:6387
 *    (binário Redis real, processo do worker; dados voláteis — documentado);
 * 3. senão → null (caller cai para LocalQueue).
 */
export async function resolveRedisUrl(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (env.BGO_REDIS_URL) return env.BGO_REDIS_URL;
  if (env.BGO_REDIS_EMBEDDED !== "1") return null;
  const { RedisMemoryServer } = await import("redis-memory-server");
  const server = new RedisMemoryServer({ instance: { port: 6387, ip: "127.0.0.1" } });
  await server.start();
  const port = await server.getPort();
  const host = await server.getHost();
  console.log(`[bgo-worker] Redis embutido ativo em ${host}:${port} (memória — reinicia com o processo)`);
  return `redis://${host}:${port}`;
}

async function demoFlowHandler(store: StorePort, payload: unknown) {
  await runDemoFlow(store, payload as Parameters<typeof runDemoFlow>[1]);
}

/** Cria worker com backend persistente (BullMQ) se Redis disponível. */
export async function createWorker(store: StorePort): Promise<{ queue: LocalQueue | PersistentQueue; backend: QueueBackend }> {
  const redisUrl = await resolveRedisUrl();
  if (redisUrl) {
    const queue = new PersistentQueue(redisUrl);
    queue.register("demo-flow", (data) => demoFlowHandler(store, data.payload));
    queue.register("noop", () => undefined);
    queue.startWorker(2);
    console.log(`[bgo-worker] BullMQ ativo via ${redisUrl.replace(/\/\/.*@/, "//***@")} — fila persistente`);
    return { queue, backend: "bullmq" };
  }
  const queue = new LocalQueue();
  queue.register("demo-flow", (job) => {
    void demoFlowHandler(store, job.payload);
  });
  queue.register("noop", () => undefined);
  return { queue, backend: "local" };
}

// Entrypoint standalone.
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  void (async () => {
    const store: StorePort = new Store();
    const { queue, backend } = await createWorker(store);
    console.log(`[bgo-worker] backend=${backend} — modo mock, sem envios externos`);
    if (backend === "local") {
      setInterval(() => {
        void (queue as LocalQueue).tick();
      }, 500);
    }
    // bullmq: Worker já consome continuamente; manter processo vivo
    setInterval(() => undefined, 60_000);
  })();
}
