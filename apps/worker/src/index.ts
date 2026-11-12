import { Store, runDemoFlow, type StorePort } from "@bgo/commercial";
import { LocalQueue } from "./queue";
import { PersistentQueue } from "./persistent-queue";

export { LocalQueue } from "./queue";
export { PersistentQueue } from "./persistent-queue";
export type { Job, JobHandler } from "./queue";

export type QueueBackend = "local" | "bullmq";
export type StoreBackend = "postgres" | "memory";

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

/**
 * Resolve StorePort do worker (Onda 03 — worker persistente):
 * 1. DATABASE_URL definida → PrismaStore compartilhado com a API (mesmo banco).
 *    Para PGlite dev: rode `pnpm --filter @bgo/db pglite:up` e exporte a
 *    DATABASE_URL impressa; API e worker conectam via socket 127.0.0.1:5437.
 * 2. Sem DATABASE_URL → Store em memória (modo mock/testes; documentado).
 * O worker NUNCA abre o dataDir do PGlite diretamente (lock por processo) —
 * sempre via socket compartilhado.
 */
export async function resolveStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ store: StorePort; backend: StoreBackend; disconnect?: () => Promise<void> }> {
  if (env.BGO_PERSISTENCE === "memory" || !env.DATABASE_URL) {
    if (env.BGO_PERSISTENCE !== "memory" && !env.DATABASE_URL) {
      console.warn("[bgo-worker] DATABASE_URL ausente — Store em memória (volátil). Para persistência: pglite:up + DATABASE_URL.");
    }
    return { store: new Store(), backend: "memory" };
  }
  try {
    const { PrismaStore, disconnectPrisma } = await import("@bgo/db");
    const store = new PrismaStore();
    await store.init();
    console.log(`[bgo-worker] Store persistente via ${env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`);
    return { store, backend: "postgres", disconnect: disconnectPrisma };
  } catch (e) {
    console.warn(`[bgo-worker] persistência indisponível (${(e as Error).message}) — caindo para memória`);
    return { store: new Store(), backend: "memory" };
  }
}

/** Idempotência de domínio: se já existe missão com o correlationId, não reexecuta. */
async function alreadyProcessed(store: StorePort, correlationId: string): Promise<boolean> {
  const missions = await store.listMissions();
  return missions.some((m) => m.correlationId === correlationId);
}

async function demoFlowHandler(store: StorePort, payload: unknown): Promise<void> {
  const input = (payload ?? {}) as { correlationId?: string };
  const correlationId = typeof input.correlationId === "string" ? input.correlationId : undefined;
  if (correlationId && (await alreadyProcessed(store, correlationId))) {
    console.log(`[bgo-worker] demo-flow correlationId=${correlationId} já processado — skip (idempotência de domínio)`);
    return;
  }
  await runDemoFlow(store, undefined, correlationId ? { correlationId } : undefined);
}

/** Cria worker com backend de fila escolhido e store injetado. */
export async function createWorker(
  store: StorePort,
  opts: { redisUrl?: string | null } = {},
): Promise<{ queue: LocalQueue | PersistentQueue; backend: QueueBackend }> {
  const redisUrl = opts.redisUrl !== undefined ? opts.redisUrl : await resolveRedisUrl();
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

// Entrypoint standalone: store persistente se DATABASE_URL, senão memória.
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  void (async () => {
    const { store, backend: storeBackend, disconnect } = await resolveStoreFromEnv();
    const { queue, backend } = await createWorker(store);
    console.log(`[bgo-worker] store=${storeBackend} queue=${backend} — modo mock, sem envios externos`);
    if (backend === "local") {
      const local = queue as LocalQueue;
      setInterval(() => {
        void local.tick();
      }, 500);
    }

    // Shutdown gracioso: fecha worker/fila e desconecta Prisma.
    const shutdown = async (signal: string) => {
      console.log(`[bgo-worker] ${signal} — encerrando graciosamente`);
      await (queue as PersistentQueue).close?.().catch(() => undefined);
      await disconnect?.().catch(() => undefined);
      process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));

    setInterval(() => undefined, 60_000); // manter processo vivo (bullmq consome internamente)
  })();
}
