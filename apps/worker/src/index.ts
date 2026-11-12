import { Store, runDemoFlow } from "@bgo/commercial";
import { LocalQueue } from "./queue";

export { LocalQueue };
export type { Job, JobHandler } from "./queue";

/**
 * Worker Onda 00: processa jobs internos em modo mock.
 * Tipos de job: `demo-flow` (fluxo sintético completo), `noop`.
 */
export function createWorker(store: Store): { queue: LocalQueue } {
  const queue = new LocalQueue();
  queue.register("demo-flow", (job) => {
    runDemoFlow(store, job.payload as Parameters<typeof runDemoFlow>[1]);
  });
  queue.register("noop", () => {
    // job interno sem efeito externo — usado em testes de fila
  });
  return { queue };
}

// Entrypoint standalone (uso manual): mantém processo vivo processando ticks.
const isMain = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMain) {
  const store = new Store();
  const { queue } = createWorker(store);
  console.log("[bgo-worker] modo mock — fila local ativa (sem Redis/BullMQ até Docker seguro)");
  setInterval(() => {
    void queue.tick();
  }, 500);
}
