/**
 * OutboxPublisher — drenagem confiável de EventOutbox → barramento (SSE).
 *
 * Semântica AT-LEAST-ONCE (nunca exactly-once):
 * - emit() antes de markEventPublished(): se o mark falhar, o evento
 *   permanece não publicado e será reentregue (duplicata possível —
 *   consumidores deduplicam por eventId).
 * - Falha no emit(): evento NÃO é marcado; retentativa com backoff
 *   exponencial por eventId; após maxAttempts fica "failed" (métrica)
 *   mas continua elegível em drains futuros.
 * - Baseline: marca eventos anteriores ao start como publicados SEM
 *   reemitir — eles já foram entregues ao vivo antes do publisher
 *   existir; evita replay do histórico inteiro a cada restart.
 */

export interface OutboxEvent {
  eventId: string;
  eventType: string;
  version: number;
  workspaceId: string;
  correlationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  missionId?: string;
  agentId?: string;
}

export interface OutboxStore {
  listUnpublishedEvents(limit?: number): Promise<OutboxEvent[]>;
  markEventPublished(eventId: string): Promise<void>;
}

export type EmitFn = (event: OutboxEvent) => void | Promise<void>;

export interface PublisherMetrics {
  published: number;
  retried: number;
  failed: number;
  pending: number;
}

export interface OutboxPublisherOptions {
  intervalMs?: number;
  batchSize?: number;
  maxAttempts?: number;
  /** eventos com occurredAt < startedAt são candidatos a baseline.
   *  ATENÇÃO: occurredAt NÃO comprova entrega — ver baselineMode. */
  baselineCutoff?: string;
  /** Estratégia de reconciliação de eventos legados (pré-publisher):
   *  - "mark" (default): marca como publicados SEM reemitir — usar apenas
   *    quando se assume que o evento já foi entregue ao vivo;
   *  - "deliver": não marca — drain os emite normalmente (replay único);
   *  - "skip": não faz baseline — tudo pendente é drenado. */
  baselineMode?: "mark" | "deliver" | "skip";
  onMetric?: (name: keyof PublisherMetrics | "drain" | "baseline", value?: number) => void;
}

interface PendingState { attempts: number; nextAttemptAt: number }

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 60_000;

export class OutboxPublisher {
  private timer: NodeJS.Timeout | null = null;
  private draining = false;
  private readonly attempts = new Map<string, PendingState>();
  private readonly metrics: PublisherMetrics = { published: 0, retried: 0, failed: 0, pending: 0 };
  private readonly startedAt: string;

  constructor(
    private readonly store: OutboxStore,
    private readonly emit: EmitFn,
    private readonly opts: OutboxPublisherOptions = {},
  ) {
    this.startedAt = opts.baselineCutoff ?? new Date().toISOString();
  }

  metricsSnapshot(): PublisherMetrics { return { ...this.metrics }; }

  /** Reconciliação de eventos legados. Retorna quantos foram marcados. */
  async baseline(): Promise<number> {
    const mode = this.opts.baselineMode ?? "mark";
    if (mode === "skip" || mode === "deliver") {
      this.opts.onMetric?.("baseline", 0);
      return 0; // pendentes preservados — drain os entrega
    }
    const old = await this.store.listUnpublishedEvents(10000);
    let n = 0;
    for (const ev of old) {
      if (ev.occurredAt < this.startedAt) {
        await this.store.markEventPublished(ev.eventId);
        n++;
      }
    }
    this.opts.onMetric?.("baseline", n);
    this.opts.onMetric?.("drain");
    return n;
  }

  /** Uma batida de drenagem. Retorna quantos foram publicados. */
  async drainOnce(now = Date.now()): Promise<number> {
    if (this.draining) return 0;
    this.draining = true;
    let published = 0;
    try {
      const pending = await this.store.listUnpublishedEvents(this.opts.batchSize ?? 100);
      this.metrics.pending = pending.length;
      for (const ev of pending) {
        const st = this.attempts.get(ev.eventId);
        if (st && st.nextAttemptAt > now) continue; // backoff ainda não venceu
        try {
          await this.emit(ev);
        } catch {
          const attempts = (st?.attempts ?? 0) + 1;
          const delay = Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
          this.attempts.set(ev.eventId, { attempts, nextAttemptAt: now + delay });
          this.metrics.retried++;
          if (attempts >= (this.opts.maxAttempts ?? 8)) this.metrics.failed++;
          continue; // não marca — será retentado
        }
        try {
          await this.store.markEventPublished(ev.eventId);
          this.attempts.delete(ev.eventId);
          this.metrics.published++;
          published++;
        } catch {
          // emit ok mas mark falhou → evento continua pendente →
          // será reemitido no próximo drain (duplicata possível, at-least-once)
          this.metrics.retried++;
        }
      }
      this.opts.onMetric?.("drain");
      return published;
    } finally {
      this.draining = false;
    }
  }

  start(): void {
    if (this.timer !== null) return;
    const tick = async () => {
      try {
        await this.drainOnce();
      } catch {
        /* falha transitória de banco — próxima batida retenta */
      }
    };
    void this.baseline().then(tick);
    this.timer = setInterval(() => void tick(), this.opts.intervalMs ?? 5000);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    // shutdown controlado: uma última batida antes de sair
    try { await this.drainOnce(); } catch { /* ignora */ }
  }
}
