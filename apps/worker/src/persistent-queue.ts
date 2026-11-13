import { Queue as RedisQueue, Worker, type Job as BullJob } from "bullmq";
import { Redis } from "ioredis";

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

/** Contexto passado ao handler para cancelamento cooperativo (Onda 04/G32). */
export interface JobContext {
  /** true se cancel() foi solicitado para este idempotencyKey. Handlers
   *  longos devem verificar periodicamente e abortar os efeitos restantes. */
  isCancelled(): Promise<boolean>;
}

export type JobHandler = (data: PersistentJobData, ctx?: JobContext) => Promise<void> | void;

export interface WorkerTuning {
  stalledIntervalMs?: number;
  lockDurationMs?: number;
  maxStalledCount?: number;
}

const connOpts = (url: string) => ({ url, maxRetriesPerRequest: null as null });
const CANCEL_SET = "bgo:cancel-requests";

export class PersistentQueue {
  readonly name = "bgo-jobs";
  readonly dlqName = "bgo-dlq";
  private readonly redisUrl: string;
  private queue: RedisQueue<PersistentJobData>;
  private dlq: RedisQueue<PersistentJobData>;
  private worker?: Worker<PersistentJobData>;
  private handlers = new Map<string, JobHandler>();
  private processedKeys = new Set<string>();
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
    const connection = connOpts(redisUrl);
    this.queue = new RedisQueue<PersistentJobData>(this.name, { connection });
    this.dlq = new RedisQueue<PersistentJobData>(this.dlqName, { connection });
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }

  register(type: string, handler: JobHandler): void {
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
  startWorker(concurrency = 2, tuning: WorkerTuning = {}): Worker<PersistentJobData> {
    if (this.worker) return this.worker;
    this.worker = new Worker<PersistentJobData>(
      this.name,
      async (job: BullJob<PersistentJobData>) => {
        const key = job.data.idempotencyKey;
        // cancelamento cooperativo: flag em Redis cobre jobs ativos que o
        // BullMQ não consegue remover (job.remove() falha em job 'active')
        if ((await this.redis.sismember(CANCEL_SET, key)) === 1) {
          await this.redis.srem(CANCEL_SET, key).catch(() => undefined);
          await job.discard();
          throw new Error(`job cancelado antes da execução: ${key}`);
        }
        const handler = this.handlers.get(job.data.type);
        if (!handler) throw new Error(`sem handler para tipo: ${job.data.type}`);
        const ctx: JobContext = {
          isCancelled: async () => (await this.redis.sismember(CANCEL_SET, key)) === 1,
        };
        await handler(job.data, ctx);
        this.processedKeys.add(key);
        await this.redis.srem(CANCEL_SET, key).catch(() => undefined);
      },
      {
        connection: connOpts(this.redisUrl),
        concurrency,
        stalledInterval: tuning.stalledIntervalMs ?? 10_000,
        lockDuration: tuning.lockDurationMs ?? 30_000,
        maxStalledCount: tuning.maxStalledCount ?? 1,
      },
    );
    this.worker.on("failed", (job, err) => {
      void (async () => {
        if (!job) return;
        await this.redis.srem(CANCEL_SET, job.data.idempotencyKey).catch(() => undefined);
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

  /**
   * Cancela por idempotencyKey. Jobs waiting/delayed são removidos do Redis;
   * jobs ACTIVE não podem ser removidos pelo BullMQ — para eles gravamos uma
   * flag em `bgo:cancel-requests` que o processor verifica antes de executar
   * e que handlers longos podem consultar via `ctx.isCancelled()`.
   */
  async cancel(idempotencyKey: string): Promise<boolean> {
    const job = await this.queue.getJob(idempotencyKey).catch(() => undefined);
    if (!job) return false;
    await this.redis.sadd(CANCEL_SET, idempotencyKey);
    try {
      await job.remove();
    } catch {
      // job ativo/travado: permanece na fila até o handler ceder via ctx
    }
    return true;
  }

  /** true se há pedido de cancelamento pendente para a chave. */
  async isCancelRequested(idempotencyKey: string): Promise<boolean> {
    return (await this.redis.sismember(CANCEL_SET, idempotencyKey)) === 1;
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
    await this.redis.quit().catch(() => undefined);
  }
}
