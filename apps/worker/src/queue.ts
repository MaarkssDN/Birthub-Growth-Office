/**
 * Fila local com semântica BullMQ (idempotência, retry+backoff, DLQ, pausa).
 * Substituível por BullMQ real quando Redis estiver disponível (ADR-004).
 * Agendamentos futuros usarão BullMQ Job Schedulers — nunca `repeat` legado.
 */
export interface Job<T = unknown> {
  id: string;
  idempotencyKey: string;
  type: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  status: "queued" | "running" | "done" | "failed" | "dead";
  runAt: number;
  lastError?: string;
}

export type JobHandler<T = unknown> = (job: Job<T>) => Promise<void> | void;

export class LocalQueue {
  private jobs = new Map<string, Job>();
  private handlers = new Map<string, JobHandler>();
  private processedKeys = new Set<string>();
  private paused = false;
  readonly deadLetter: Job[] = [];

  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /** Idempotente: mesma idempotencyKey não enfileira duplicado. */
  enqueue<T>(type: string, payload: T, opts?: { idempotencyKey?: string; maxAttempts?: number; delayMs?: number }): Job<T> {
    const key = opts?.idempotencyKey ?? `${type}:${JSON.stringify(payload)}`;
    const existing = [...this.jobs.values()].find(
      (j) => j.idempotencyKey === key && (j.status === "queued" || j.status === "running"),
    );
    if (existing) return existing as Job<T>;
    if (this.processedKeys.has(key)) {
      const done = { id: `dup-${key}`, idempotencyKey: key, type, payload, attempts: 0, maxAttempts: 1, status: "done" as const, runAt: 0 };
      return done as Job<T>;
    }
    const job: Job<T> = {
      id: `job_${Math.random().toString(36).slice(2, 10)}`,
      idempotencyKey: key,
      type,
      payload,
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? 3,
      status: "queued",
      runAt: Date.now() + (opts?.delayMs ?? 0),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Processa jobs devidos uma vez (tick). Retorna jobs executados. */
  async tick(): Promise<Job[]> {
    if (this.paused) return [];
    const now = Date.now();
    const due = [...this.jobs.values()].filter(
      (j) => j.status === "queued" && j.runAt <= now,
    );
    const ran: Job[] = [];
    for (const job of due) {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        job.status = "dead";
        this.deadLetter.push(job);
        continue;
      }
      job.status = "running";
      job.attempts += 1;
      try {
        await handler(job);
        job.status = "done";
        this.processedKeys.add(job.idempotencyKey);
      } catch (e) {
        job.lastError = (e as Error).message;
        if (job.attempts >= job.maxAttempts) {
          job.status = "dead";
          this.deadLetter.push(job);
        } else {
          job.status = "queued";
          job.runAt = Date.now() + 100 * 2 ** job.attempts; // backoff exponencial
        }
      }
      ran.push(job);
    }
    return ran;
  }

  list(status?: Job["status"]): Job[] {
    const all = [...this.jobs.values()];
    return status ? all.filter((j) => j.status === status) : all;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }
}
