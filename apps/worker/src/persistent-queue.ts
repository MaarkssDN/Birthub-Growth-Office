import { Queue as RedisQueue, Worker, type Job as BullJob } from "bullmq";

/**
 * Fila persistente BullMQ (Onda 02) — substitui LocalQueue quando Redis real
 * está disponível. Semântica:
 * - idempotência: jobId = idempotencyKey (BullMQ descarta duplicado);
 * - retry: attempts + backoff exponencial configuráveis por job;
 * - DLQ: fila separada `bgo-dlq` recebe job após esgotar tentativas;
 * - pausa/retomada: Queue.pause()/resume() e Worker.pause()/resume();
 * - recuperação: BullMQ detecta jobs stalled e reprocessa após restart;
 * - entrega é AT-LEAST-ONCE: handlers devem ser idempotentes (job.data traz
 *   idempotencyKey; efeitos externos continuam bloqueados por policy).
 *
 * NOTA: `maxRetriesPerRequest: null` é obrigatório para comandos bloqueantes
 * do Worker (requisito BullMQ/ioredis).
 */
export interface PersistentJobData {
  idempotencyKey: string;
  type: string;
  payload: unknown;
  correlationId?: string;
}

export interface EnqueueOpts {
  idempotencyKey?: string;
  maxAttempts?: number;
  delayMs?: number;
  correlationId?: string;
}

const connOpts = (url: string) => ({ url, maxRetriesPerRequest: null as null });

export class PersistentQueue {
  readonly name = "bgo-jobs";
  readonly dlqName = "bgo-dlq";
  private readonly redisUrl: string;
  private queue: RedisQueue<PersistentJobData>;
  private dlq: RedisQueue<PersistentJobData>;
  private worker?: Worker<PersistentJobData>;
  private handlers = new Map<string, (data: PersistentJobData) => Promise<void> | void>();
  private processedKeys = new Set<string>();

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
    const connection = connOpts(redisUrl);
    this.queue = new RedisQueue<PersistentJobData>(this.name, { connection });
    this.dlq = new RedisQueue<PersistentJobData>(this.dlqName, { connection });
  }

  register(type: string, handler: (data: PersistentJobData) => Promise<void> | void): void {
    this.handlers.set(type, handler);
  }

  /** Idempotente: jobId determinístico = idempotencyKey. */
  async enqueue(type: string, payload: unknown, opts: EnqueueOpts = {}): Promise<{ id: string; deduplicated: boolean }> {
    const key = opts.idempotencyKey ?? `${type}:${JSON.stringify(payload)}`;
    if (this.processedKeys.has(key)) return { id: `dup-${key}`, deduplicated: true };
    const existing = await this.queue.getJob(key).catch(() => undefined);
    if (existing) return { id: key, deduplicated: true };
    const job = await this.queue.add(
      type,
      {
        idempotencyKey: key,
        type,
        payload,
        ...(opts.correlationId !== undefined ? { correlationId: opts.correlationId } : {}),
      },
      {
        jobId: key,
        attempts: opts.maxAttempts ?? 3,
        backoff: { type: "exponential", delay: 500 },
        ...(opts.delayMs !== undefined ? { delay: opts.delayMs } : {}),
        removeOnComplete: 500,
        removeOnFail: false,
      },
    );
    return { id: job.id ?? key, deduplicated: false };
  }

  /** Inicia o consumidor. BullMQ recupera jobs stalled automaticamente. */
  startWorker(concurrency = 2, stalledIntervalMs = 10_000): Worker<PersistentJobData> {
    if (this.worker) return this.worker;
    this.worker = new Worker<PersistentJobData>(
      this.name,
      async (job: BullJob<PersistentJobData>) => {
        const handler = this.handlers.get(job.data.type);
        if (!handler) throw new Error(`sem handler para tipo: ${job.data.type}`);
        await handler(job.data);
        this.processedKeys.add(job.data.idempotencyKey);
      },
      { connection: connOpts(this.redisUrl), concurrency, stalledInterval: stalledIntervalMs },
    );
    this.worker.on("failed", (job, err) => {
      void (async () => {
        if (!job) return;
        const max = job.opts.attempts ?? 3;
        if (job.attemptsMade >= max) {
          await this.dlq.add(job.name, job.data, {
            jobId: `dlq-${job.data.idempotencyKey}`,
            removeOnComplete: false,
          }).catch(() => undefined);
        }
        console.warn(`[bgo-worker] job ${job.id} falhou (tentativa ${job.attemptsMade}/${max}): ${err.message}`);
      })();
    });
    return this.worker;
  }

  async pause(): Promise<void> {
    await this.queue.pause();
    await this.worker?.pause();
  }

  async resume(): Promise<void> {
    await this.queue.resume();
    await this.worker?.resume();
  }

  async isPaused(): Promise<boolean> {
    const counts = await this.queue.getJobCounts("waiting", "delayed", "paused");
    return (counts.paused ?? 0) > 0;
  }

  async cancel(idempotencyKey: string): Promise<boolean> {
    const job = await this.queue.getJob(idempotencyKey).catch(() => undefined);
    if (!job) return false;
    await job.remove();
    return true;
  }

  async counts() {
    const [main, dlqCounts] = await Promise.all([
      this.queue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused"),
      this.dlq.getJobCounts("waiting", "active", "completed", "failed"),
    ]);
    return { main, dlq: dlqCounts };
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.dlq.close();
  }
}
