/**
 * Ledger de custos de IA (Onda 10 / G95-G96, G117-G118).
 *
 * Regras duras:
 * - estimatedCost só existe quando há tarifa ativa; NUNCA é apresentado
 *   como valor faturado. billedCost só é preenchido pelo provedor.
 * - Registros simulated=true não entram em somas de orçamento real.
 * - Orçamento: por execução (gateway), por dia e por mês — em costUnits.
 */

export interface AiTariff {
  id: string;
  version: string;
  provider: string;
  model: string;
  currency: string;
  inputPer1MTokens: number;
  outputPer1MTokens: number;
  active: boolean;
  createdAt: string;
}

export interface AiUsageInput {
  missionId?: string;
  agentId: string;
  provider: string;
  model: string;
  promptKey?: string;
  promptVersion?: string;
  simulated: boolean;
  tokensIn: number;
  tokensOut: number;
  costUnits: number;
  durationMs: number;
  status: "success" | "failure" | "blocked";
  error?: string;
  correlationId?: string;
  occurredAt?: string;
}

export interface AiUsageRecord extends AiUsageInput {
  id: string;
  occurredAt: string; // obrigatório no registro persistido
  estimatedCost: number | null;
  billedCost: number | null;
  tariffVersion: string | null;
}

export interface UsageFilter {
  missionId?: string;
  agentId?: string;
  provider?: string;
  simulated?: boolean;
  from?: string; // ISO
  to?: string;   // ISO
  limit?: number;
  offset?: number;
}

export interface UsagePage {
  items: AiUsageRecord[];
  total: number;
}

export interface CostStorePort {
  insertUsage(rec: AiUsageRecord): Promise<AiUsageRecord>;
  /**
   * Inserção atômica com enforcement de orçamento (Onda 10/G118):
   * serializa check+insert; se estourar daily/monthly, NÃO insere o consumo
   * e retorna { blocked }. Implementações PG usam advisory lock na mesma tx.
   */
  insertUsageGuarded?(
    rec: AiUsageRecord,
    limits: { dailyUnits?: number; monthlyUnits?: number; nowIso: string },
  ): Promise<{ record: AiUsageRecord } | { blocked: true; reason: string }>;
  listUsage(f: UsageFilter): Promise<UsagePage>;
  /** Soma costUnits de registros reais (simulated=false) no intervalo. */
  sumRealUnits(fromIso: string, toIso: string): Promise<number>;
  sumSimulatedUnits(fromIso: string, toIso: string): Promise<number>;
  insertTariff(t: Omit<AiTariff, "id" | "createdAt">): Promise<AiTariff>;
  listTariffs(): Promise<AiTariff[]>;
  activeTariff(provider: string, model: string): Promise<AiTariff | undefined>;
}

export interface BudgetLimits {
  dailyUnits?: number;
  monthlyUnits?: number;
}

export interface PeriodUsage {
  limit: number | null;
  used: number;
  remaining: number | null;
}

export interface BudgetStatus {
  daily: PeriodUsage;
  monthly: PeriodUsage;
  blocked: boolean;
  reason?: string;
}

export function estimateCostUsd(tokensIn: number, tokensOut: number, tariff: AiTariff): number {
  const cost = (tokensIn / 1_000_000) * tariff.inputPer1MTokens + (tokensOut / 1_000_000) * tariff.outputPer1MTokens;
  return Math.round(cost * 1e6) / 1e6;
}

let useq = 0;
const uid = () => `use_${Date.now().toString(36)}_${(useq++).toString(36)}`;

export class CostLedger {
  constructor(
    private store: CostStorePort,
    private limits: BudgetLimits = {},
    private now: () => Date = () => new Date(),
  ) {}

  /** Registra uso; calcula estimativa somente com tarifa ativa. */
  async record(input: AiUsageInput): Promise<AiUsageRecord> {
    const tariff = input.simulated ? undefined : await this.store.activeTariff(input.provider, input.model);
    const rec: AiUsageRecord = {
      ...input,
      id: uid(),
      estimatedCost: tariff ? estimateCostUsd(input.tokensIn, input.tokensOut, tariff) : null,
      billedCost: null,
      tariffVersion: tariff?.version ?? null,
      occurredAt: input.occurredAt ?? this.now().toISOString(),
    };
    // Consumo real passa pelo portão atômico de orçamento quando houver limites.
    if (!rec.simulated && (this.limits.dailyUnits !== undefined || this.limits.monthlyUnits !== undefined) && this.store.insertUsageGuarded) {
      const nowIso = this.now().toISOString();
      const res = await this.store.insertUsageGuarded(rec, { ...this.limits, nowIso });
      if ("blocked" in res) {
        // auditoria da tentativa bloqueada — costUnits 0 p/ não contar no orçamento
        return this.store.insertUsage({ ...rec, status: "blocked", costUnits: 0, error: res.reason });
      }
      return res.record;
    }
    return this.store.insertUsage(rec);
  }

  async budgetStatus(): Promise<BudgetStatus> {
    const now = this.now();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const horizon = now.toISOString();
    const [dayUsed, monthUsed] = await Promise.all([
      this.store.sumRealUnits(dayStart, horizon),
      this.store.sumRealUnits(monthStart, horizon),
    ]);
    const period = (limit: number | undefined, used: number): PeriodUsage => ({
      limit: limit ?? null,
      used,
      remaining: limit === undefined ? null : Math.max(0, limit - used),
    });
    const daily = period(this.limits.dailyUnits, dayUsed);
    const monthly = period(this.limits.monthlyUnits, monthUsed);
    const blocked =
      (daily.limit !== null && daily.used >= daily.limit) ||
      (monthly.limit !== null && monthly.used >= monthly.limit);
    return {
      daily,
      monthly,
      blocked,
      ...(blocked
        ? { reason: daily.used >= (daily.limit ?? Infinity) ? "orçamento diário excedido" : "orçamento mensal excedido" }
        : {}),
    };
  }

  /** Deve ser chamado ANTES da inferência; bloqueia se orçamento já estourado. */
  async assertBudget(): Promise<{ allowed: boolean; reason?: string }> {
    const s = await this.budgetStatus();
    return s.blocked ? { allowed: false, reason: s.reason ?? "orçamento excedido" } : { allowed: true };
  }

  async usage(f: UsageFilter): Promise<UsagePage> {
    return this.store.listUsage(f);
  }

  async tariffs(): Promise<AiTariff[]> {
    return this.store.listTariffs();
  }

  async addTariff(t: Omit<AiTariff, "id" | "createdAt">): Promise<AiTariff> {
    return this.store.insertTariff(t);
  }

  async simulatedUsage(fromIso: string, toIso: string): Promise<number> {
    return this.store.sumSimulatedUnits(fromIso, toIso);
  }
}

/** Implementação em memória — testes e modo volátil. */
export class MemoryCostStore implements CostStorePort {
  private usages: AiUsageRecord[] = [];
  private tariffs = new Map<string, AiTariff>();
  private lock: Promise<unknown> = Promise.resolve();

  async insertUsage(rec: AiUsageRecord): Promise<AiUsageRecord> {
    this.usages.push(rec);
    return rec;
  }

  /** Check+insert serializado — impede ultrapassagem por chamadas simultâneas. */
  async insertUsageGuarded(
    rec: AiUsageRecord,
    limits: { dailyUnits?: number; monthlyUnits?: number; nowIso: string },
  ): Promise<{ record: AiUsageRecord } | { blocked: true; reason: string }> {
    const run = this.lock.then(async () => {
      const now = new Date(limits.nowIso);
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const inWindow = (r: AiUsageRecord) => !r.simulated && r.status !== "blocked" && r.costUnits > 0;
      const dayUsed = this.usages.filter((r) => inWindow(r) && r.occurredAt >= dayStart && r.occurredAt <= limits.nowIso).reduce((a, r) => a + r.costUnits, 0);
      const monthUsed = this.usages.filter((r) => inWindow(r) && r.occurredAt >= monthStart && r.occurredAt <= limits.nowIso).reduce((a, r) => a + r.costUnits, 0);
      if (limits.dailyUnits !== undefined && dayUsed + rec.costUnits > limits.dailyUnits) {
        return { blocked: true as const, reason: "orçamento diário excedido" };
      }
      if (limits.monthlyUnits !== undefined && monthUsed + rec.costUnits > limits.monthlyUnits) {
        return { blocked: true as const, reason: "orçamento mensal excedido" };
      }
      this.usages.push(rec);
      return { record: rec };
    });
    this.lock = run.then(() => undefined, () => undefined);
    return run;
  }

  async listUsage(f: UsageFilter): Promise<UsagePage> {
    let items = this.usages;
    if (f.missionId) items = items.filter((r) => r.missionId === f.missionId);
    if (f.agentId) items = items.filter((r) => r.agentId === f.agentId);
    if (f.provider) items = items.filter((r) => r.provider === f.provider);
    if (f.simulated !== undefined) items = items.filter((r) => r.simulated === f.simulated);
    if (f.from) items = items.filter((r) => r.occurredAt >= f.from!);
    if (f.to) items = items.filter((r) => r.occurredAt <= f.to!);
    const sorted = [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const offset = f.offset ?? 0;
    const limit = f.limit ?? 200;
    return { items: sorted.slice(offset, offset + limit), total: sorted.length };
  }

  async sumRealUnits(fromIso: string, toIso: string): Promise<number> {
    return this.usages
      .filter((r) => !r.simulated && r.occurredAt >= fromIso && r.occurredAt <= toIso)
      .reduce((a, r) => a + r.costUnits, 0);
  }

  async sumSimulatedUnits(fromIso: string, toIso: string): Promise<number> {
    return this.usages
      .filter((r) => r.simulated && r.occurredAt >= fromIso && r.occurredAt <= toIso)
      .reduce((a, r) => a + r.costUnits, 0);
  }

  async insertTariff(t: Omit<AiTariff, "id" | "createdAt">): Promise<AiTariff> {
    const tariff: AiTariff = { ...t, id: uid().replace("use_", "tar_"), createdAt: new Date().toISOString() };
    this.tariffs.set(`${t.version}|${t.provider}|${t.model}`, tariff);
    return tariff;
  }

  async listTariffs(): Promise<AiTariff[]> {
    return [...this.tariffs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async activeTariff(provider: string, model: string): Promise<AiTariff | undefined> {
    return [...this.tariffs.values()].find((t) => t.active && t.provider === provider && t.model === model);
  }
}
