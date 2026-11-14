import type { Opportunity, OpportunityHistory, OpportunityPriority, OpportunityStage } from "@bgo/contracts";
import type { CompanyStorePort, StoredCompany } from "./company-store";

/**
 * Pipeline Comercial e Integração Empresa → Oportunidade (Onda 11 / G116, G131-G134).
 *
 * Regras invioláveis:
 * - Empresa importada não é lead nem oportunidade automática.
 * - Somente empresa com reviewStatus === "approved" pode ser promovida a Opportunity.
 * - Nenhum contato pessoal fictício é criado.
 * - Idempotência estrita por (workspaceId, companyId) contra duplo clique, retry e concorrência.
 * - Transições de estágio explícitas, validadas e auditáveis.
 */

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  approved_target: "Alvo aprovado",
  researching: "Investigação (Scout)",
  qualifying: "Qualificação (Meridian)",
  qualified: "Qualificada (ICP)",
  outreach_drafted: "Rascunho (Beacon)",
  awaiting_approval: "Aguardando aprovação",
  followup_planned: "Follow-up planejado (Pledge)",
  nurture: "Em nutrição",
  won: "Ganha",
  lost: "Perdida",
  archived: "Arquivada",
};

export const OPPORTUNITY_TRANSITIONS: Record<OpportunityStage, readonly OpportunityStage[]> = {
  approved_target: ["researching", "qualifying", "nurture", "lost", "archived"],
  researching: ["qualifying", "nurture", "lost", "archived"],
  qualifying: ["qualified", "nurture", "lost", "archived"],
  qualified: ["outreach_drafted", "awaiting_approval", "followup_planned", "nurture", "lost", "archived"],
  outreach_drafted: ["awaiting_approval", "followup_planned", "nurture", "lost", "archived"],
  awaiting_approval: ["followup_planned", "qualified", "nurture", "lost", "archived"],
  followup_planned: ["won", "nurture", "lost", "archived"],
  nurture: ["researching", "qualifying", "qualified", "lost", "archived"],
  won: ["archived"],
  lost: ["nurture", "archived"],
  archived: ["nurture"],
};

export class InvalidOpportunityTransition extends Error {
  constructor(from: OpportunityStage, to: OpportunityStage, detail?: string) {
    super(detail ?? `transição de oportunidade inválida: ${from} → ${to}`);
    this.name = "InvalidOpportunityTransition";
  }
}

export function canTransitionOpportunity(from: OpportunityStage, to: OpportunityStage): boolean {
  return OPPORTUNITY_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertOpportunityTransition(from: OpportunityStage, to: OpportunityStage, reason?: string): void {
  if (!canTransitionOpportunity(from, to)) {
    throw new InvalidOpportunityTransition(from, to);
  }
  if ((to === "lost" || to === "archived") && (!reason || !reason.trim())) {
    throw new InvalidOpportunityTransition(from, to, `transição para ${to} exige motivo de perda ou arquivamento`);
  }
}

const PRIORITY_ORDER: readonly OpportunityPriority[] = ["low", "normal", "high", "critical"];

export function priorityRank(p: OpportunityPriority): number {
  return PRIORITY_ORDER.indexOf(p);
}

/** Teto determinístico de prioridade segundo a pontuação ICP do dossiê/Meridian. */
export function maxPriorityForScore(score: number): OpportunityPriority {
  if (score >= 80) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "normal";
  return "low";
}

export function checkPriorityRule(
  score: number,
  requested: OpportunityPriority,
): { allowedDirect: boolean; maxAllowed: OpportunityPriority; reason?: string } {
  const maxAllowed = maxPriorityForScore(score);
  if (priorityRank(requested) > priorityRank(maxAllowed)) {
    return {
      allowedDirect: false,
      maxAllowed,
      reason: `Prioridade '${requested}' excede o teto determinístico '${maxAllowed}' para score ICP ${score}/100 — exige aprovação na Central de Aprovações`,
    };
  }
  return { allowedDirect: true, maxAllowed };
}

export interface OpportunityFilters {
  stage?: OpportunityStage;
  currentAgentId?: string;
  priority?: OpportunityPriority;
  minScore?: number;
  maxScore?: number;
  companyId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface EnrichedOpportunity extends Opportunity {
  company?: StoredCompany;
  pendingApprovalsCount?: number;
}

export interface OpportunityPage {
  items: EnrichedOpportunity[];
  total: number;
  page: number;
  pageSize: number;
  stageCounts: Record<string, number>;
}

export interface PromoteCompanyInput {
  companyId: string;
  approvedBy: string;
  justification: string;
  correlationId: string;
  ownerId?: string;
}

export interface PromoteCompanyResult {
  opportunity: Opportunity;
  created: boolean;
  duplicate: boolean;
}

export interface OpportunityStorePort {
  promoteCompany(input: PromoteCompanyInput): Promise<PromoteCompanyResult>;
  getOpportunity(id: string): Promise<Opportunity | undefined>;
  getOpportunityByCompany(companyId: string): Promise<Opportunity | undefined>;
  listOpportunities(f: OpportunityFilters): Promise<OpportunityPage>;
  transitionOpportunity(
    id: string,
    to: OpportunityStage,
    actor: string,
    opts: {
      reason?: string;
      correlationId: string;
      currentAgentId?: string | null;
      nextAction?: string | null;
      missionId?: string;
      icpScore?: number;
      priority?: OpportunityPriority;
      details?: Record<string, unknown>;
    },
  ): Promise<Opportunity>;
  updateOpportunity(
    id: string,
    patch: Partial<Pick<Opportunity, "currentAgentId" | "nextAction" | "missionId" | "icpScore" | "priority" | "lostReason" | "ownerId">>,
    actor: string,
    historyEntry?: { action: string; reason?: string; details?: Record<string, unknown>; correlationId: string },
  ): Promise<Opportunity>;
  opportunityHistory(opportunityId: string): Promise<OpportunityHistory[]>;
}

let oseq = 0;
const oid = (p: string) => `${p}_${Date.now().toString(36)}_${(oseq++).toString(36)}`;

/**
 * Implementação em memória de OpportunityStorePort — idempotente e segura sob
 * concorrência via fila de promessas (mutex em processo).
 */
export class MemoryOpportunityStore implements OpportunityStorePort {
  private opportunities = new Map<string, Opportunity>();
  private byCompany = new Map<string, string>(); // companyId -> opportunityId
  private history = new Map<string, OpportunityHistory[]>();
  private lock: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly companies: CompanyStorePort,
    private readonly workspaceId = "ws_birthub_growth",
  ) {}

  async promoteCompany(input: PromoteCompanyInput): Promise<PromoteCompanyResult> {
    const run = this.lock.then(async () => {
      const existingId = this.byCompany.get(input.companyId);
      if (existingId) {
        const existing = this.opportunities.get(existingId)!;
        return { opportunity: existing, created: false, duplicate: true };
      }
      const company = await this.companies.getCompany(input.companyId);
      if (!company) {
        throw new Error(`empresa não encontrada: ${input.companyId}`);
      }
      if (company.reviewStatus !== "approved") {
        throw new Error(
          `empresa precisa estar aprovada na Central Scout antes de criar oportunidade comercial (status atual: ${company.reviewStatus})`,
        );
      }
      const now = new Date().toISOString();
      const priority = maxPriorityForScore(company.score);
      const opp: Opportunity = {
        id: oid("opp"),
        workspaceId: this.workspaceId,
        companyId: company.id,
        stage: "approved_target",
        priority,
        icpScore: company.score,
        currentAgentId: "aegis",
        nextAction: "Iniciar missão de prospecção com os 6 agentes (Aegis → Relay → Scout → Meridian → Beacon → Pledge)",
        justification: input.justification,
        source: `scout:${company.fonte}`,
        approvedBy: input.approvedBy,
        approvedAt: now,
        correlationId: input.correlationId,
        lastActivityAt: now,
        icpVersion: 1,
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        createdAt: now,
        updatedAt: now,
      };
      this.opportunities.set(opp.id, opp);
      this.byCompany.set(company.id, opp.id);
      this.appendHistory({
        opportunityId: opp.id,
        toStage: "approved_target",
        action: "created",
        actor: input.approvedBy,
        reason: input.justification,
        details: {
          companyId: company.id,
          cnpj: company.cnpj,
          razaoSocial: company.razaoSocial,
          batchId: company.batchId ?? null,
          fonte: company.fonte,
          icpScore: company.score,
        },
        correlationId: input.correlationId,
      });
      if (this.companies.recordHistory) {
        await this.companies.recordHistory(company.id, "opportunity_created", input.approvedBy, input.justification, {
          opportunityId: opp.id,
          correlationId: input.correlationId,
        });
      }
      return { opportunity: opp, created: true, duplicate: false };
    });
    this.lock = run.then(() => undefined, () => undefined);
    return run;
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    return this.opportunities.get(id);
  }

  async getOpportunityByCompany(companyId: string): Promise<Opportunity | undefined> {
    const id = this.byCompany.get(companyId);
    return id ? this.opportunities.get(id) : undefined;
  }

  async listOpportunities(f: OpportunityFilters): Promise<OpportunityPage> {
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 50));
    const all = [...this.opportunities.values()];

    const stageCounts: Record<string, number> = {};
    for (const o of all) {
      stageCounts[o.stage] = (stageCounts[o.stage] ?? 0) + 1;
    }

    const enriched: EnrichedOpportunity[] = await Promise.all(
      all.map(async (o) => {
        const company = o.companyId ? await this.companies.getCompany(o.companyId) : undefined;
        return {
          ...o,
          ...(company ? { company } : {}),
        };
      }),
    );

    let items = enriched;
    if (f.stage) items = items.filter((o) => o.stage === f.stage);
    if (f.currentAgentId) items = items.filter((o) => o.currentAgentId === f.currentAgentId);
    if (f.priority) items = items.filter((o) => o.priority === f.priority);
    if (f.companyId) items = items.filter((o) => o.companyId === f.companyId);
    if (f.minScore !== undefined) items = items.filter((o) => o.icpScore >= f.minScore!);
    if (f.maxScore !== undefined) items = items.filter((o) => o.icpScore <= f.maxScore!);
    if (f.q) {
      const q = f.q.toLowerCase();
      items = items.filter(
        (o) =>
          (o.company?.razaoSocial ?? "").toLowerCase().includes(q) ||
          (o.company?.nomeFantasia ?? "").toLowerCase().includes(q) ||
          (o.company?.cnpj ?? "").includes(q) ||
          (o.nextAction ?? "").toLowerCase().includes(q) ||
          o.justification.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => b.icpScore - a.icpScore || b.updatedAt.localeCompare(a.updatedAt));
    const total = items.length;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      stageCounts,
    };
  }

  async transitionOpportunity(
    id: string,
    to: OpportunityStage,
    actor: string,
    opts: {
      reason?: string;
      correlationId: string;
      currentAgentId?: string | null;
      nextAction?: string | null;
      missionId?: string;
      icpScore?: number;
      priority?: OpportunityPriority;
      details?: Record<string, unknown>;
    },
  ): Promise<Opportunity> {
    const opp = this.opportunities.get(id);
    if (!opp) throw new Error(`oportunidade não encontrada: ${id}`);
    const from = opp.stage;
    assertOpportunityTransition(from, to, opts.reason);
    const now = new Date().toISOString();
    const updated: Opportunity = {
      ...opp,
      stage: to,
      lastActivityAt: now,
      updatedAt: now,
      ...(opts.currentAgentId !== undefined
        ? opts.currentAgentId === null
          ? { currentAgentId: undefined }
          : { currentAgentId: opts.currentAgentId }
        : {}),
      ...(opts.nextAction !== undefined
        ? opts.nextAction === null
          ? { nextAction: undefined }
          : { nextAction: opts.nextAction }
        : {}),
      ...(opts.missionId !== undefined ? { missionId: opts.missionId } : {}),
      ...(opts.icpScore !== undefined ? { icpScore: opts.icpScore } : {}),
      ...(opts.priority !== undefined ? { priority: opts.priority } : {}),
      ...(to === "lost" || to === "archived" ? { lostReason: opts.reason } : {}),
    };
    this.opportunities.set(id, updated);
    this.appendHistory({
      opportunityId: id,
      fromStage: from,
      toStage: to,
      action: to === "lost" ? "lost" : to === "archived" ? "archived" : "stage_changed",
      actor,
      ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
      ...(opts.details !== undefined ? { details: opts.details } : {}),
      correlationId: opts.correlationId,
    });
    return updated;
  }

  async updateOpportunity(
    id: string,
    patch: Partial<Pick<Opportunity, "currentAgentId" | "nextAction" | "missionId" | "icpScore" | "priority" | "lostReason" | "ownerId">>,
    actor: string,
    historyEntry?: { action: string; reason?: string; details?: Record<string, unknown>; correlationId: string },
  ): Promise<Opportunity> {
    const opp = this.opportunities.get(id);
    if (!opp) throw new Error(`oportunidade não encontrada: ${id}`);
    const now = new Date().toISOString();
    const updated: Opportunity = {
      ...opp,
      ...patch,
      id: opp.id,
      lastActivityAt: now,
      updatedAt: now,
    };
    this.opportunities.set(id, updated);
    if (historyEntry) {
      this.appendHistory({
        opportunityId: id,
        fromStage: opp.stage,
        toStage: updated.stage,
        action: historyEntry.action,
        actor,
        ...(historyEntry.reason !== undefined ? { reason: historyEntry.reason } : {}),
        ...(historyEntry.details !== undefined ? { details: historyEntry.details } : {}),
        correlationId: historyEntry.correlationId,
      });
    }
    return updated;
  }

  async opportunityHistory(opportunityId: string): Promise<OpportunityHistory[]> {
    return this.history.get(opportunityId) ?? [];
  }

  private appendHistory(input: Omit<OpportunityHistory, "id" | "occurredAt">): void {
    const list = this.history.get(input.opportunityId) ?? [];
    list.push({
      ...input,
      id: oid("oph"),
      occurredAt: new Date().toISOString(),
    });
    this.history.set(input.opportunityId, list);
  }
}
