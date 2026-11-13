import { Prisma, type PrismaClient } from "@prisma/client";
import type { CompanyDossier } from "@bgo/commercial";
import {
  assertOpportunityTransition,
  maxPriorityForScore,
  type AiTariff,
  type AiUsageRecord,
  type CompanyFilters,
  type CompanyHistoryRecord,
  type CompanyPage,
  type CompanyReviewDecision,
  type CompanyReviewStatus,
  type CompanyStorePort,
  type CostStorePort,
  type EnrichedOpportunity,
  type ImportBatchRecord,
  type OpportunityFilters,
  type OpportunityPage,
  type OpportunityStorePort,
  type PromoteCompanyInput,
  type PromoteCompanyResult,
  type StoredCompany,
  type UsageFilter,
  type UsagePage,
} from "@bgo/commercial";
import type { Opportunity, OpportunityHistory, OpportunityPriority, OpportunityStage } from "@bgo/contracts";
import { prisma as defaultPrisma } from "./client";

const iso = (d: Date): string => d.toISOString();
const j = <T>(v: unknown): T => v as T;
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

type CompanyRow = {
  id: string; batchId: string | null; cnpj: string; razaoSocial: string;
  nomeFantasia: string | null; cnae: string | null; porte: string | null;
  situacao: string | null; municipio: string | null; uf: string | null;
  fonte: string; importadoEm: Date; score: number; scoreVersion: string;
  reasons: unknown; gaps: unknown; reviewStatus: string;
  reviewedBy: string | null; reviewedAt: Date | null; reviewReason: string | null;
  missionId: string | null; createdAt: Date; updatedAt: Date;
};

function toStoredCompany(c: CompanyRow): StoredCompany {
  return {
    id: c.id,
    ...(c.batchId ? { batchId: c.batchId } : {}),
    cnpj: c.cnpj,
    razaoSocial: c.razaoSocial,
    ...(c.nomeFantasia ? { nomeFantasia: c.nomeFantasia } : {}),
    ...(c.cnae ? { cnae: c.cnae } : {}),
    ...(c.porte ? { porte: c.porte } : {}),
    ...(c.situacao ? { situacao: c.situacao } : {}),
    ...(c.municipio ? { municipio: c.municipio } : {}),
    ...(c.uf ? { uf: c.uf } : {}),
    fonte: c.fonte,
    importadoEm: iso(c.importadoEm),
    score: c.score,
    scoreVersion: c.scoreVersion,
    reasons: j<string[]>(c.reasons),
    gaps: j<string[]>(c.gaps),
    reviewStatus: c.reviewStatus as CompanyReviewStatus,
    ...(c.reviewedBy ? { reviewedBy: c.reviewedBy } : {}),
    ...(c.reviewedAt ? { reviewedAt: iso(c.reviewedAt) } : {}),
    ...(c.reviewReason ? { reviewReason: c.reviewReason } : {}),
    ...(c.missionId ? { missionId: c.missionId } : {}),
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

/** CompanyStorePort sobre PostgreSQL — dedup por (workspaceId, cnpj) via unique + advisory lock. */
export class PrismaCompanyStore implements CompanyStorePort {
  constructor(private prisma: PrismaClient = defaultPrisma(), private workspaceId = "") {}

  async createImportBatch(input: Parameters<CompanyStorePort["createImportBatch"]>[0]): Promise<ImportBatchRecord> {
    const b = await this.prisma.importBatch.create({
      data: {
        workspaceId: this.workspaceId,
        fonte: input.fonte,
        ...(input.filename !== undefined ? { filename: input.filename } : {}),
        ...(input.missionId !== undefined ? { missionId: input.missionId } : {}),
        correlationId: input.correlationId,
        totalRows: input.totalRows,
        imported: input.imported,
        duplicates: input.duplicates,
        rejected: input.rejected,
        ...(input.rejectedDetail !== undefined ? { rejectedDetail: asJson(input.rejectedDetail) } : {}),
        importedBy: input.importedBy,
      },
    });
    return {
      id: b.id,
      fonte: b.fonte,
      ...(b.filename ? { filename: b.filename } : {}),
      ...(b.missionId ? { missionId: b.missionId } : {}),
      correlationId: b.correlationId,
      totalRows: b.totalRows,
      imported: b.imported,
      duplicates: b.duplicates,
      rejected: b.rejected,
      ...(b.rejectedDetail ? { rejectedDetail: j<{ line: number; reason: string }[]>(b.rejectedDetail) } : {}),
      importedBy: b.importedBy,
      createdAt: iso(b.createdAt),
    };
  }

  async upsertCompanies(batchId: string, dossiers: CompanyDossier[], missionId?: string): Promise<{ inserted: number; duplicates: number }> {
    let inserted = 0;
    let duplicates = 0;
    for (const d of dossiers) {
      const c = d.company;
      const outcome = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `${this.workspaceId}:cnpj:${c.cnpj}`);
        const existing = await tx.company.findUnique({
          where: { workspaceId_cnpj: { workspaceId: this.workspaceId, cnpj: c.cnpj } },
        });
        if (existing) {
          await tx.companyHistory.create({
            data: {
              companyId: existing.id,
              action: "reimport_seen",
              actor: "system",
              details: asJson({ batchId, score: d.score }),
            },
          });
          return "duplicate" as const;
        }
        const created = await tx.company.create({
          data: {
            workspaceId: this.workspaceId,
            batchId,
            cnpj: c.cnpj,
            razaoSocial: c.razaoSocial,
            ...(c.nomeFantasia !== undefined ? { nomeFantasia: c.nomeFantasia } : {}),
            ...(c.cnae !== undefined ? { cnae: c.cnae } : {}),
            ...(c.porte !== undefined ? { porte: c.porte } : {}),
            ...(c.situacao !== undefined ? { situacao: c.situacao } : {}),
            ...(c.municipio !== undefined ? { municipio: c.municipio } : {}),
            ...(c.uf !== undefined ? { uf: c.uf } : {}),
            fonte: c.fonte,
            importadoEm: new Date(c.importadoEm),
            score: d.score,
            reasons: asJson(d.reasons),
            gaps: asJson(d.gaps),
            ...(missionId !== undefined ? { missionId } : {}),
          },
        });
        await tx.companyHistory.create({
          data: {
            companyId: created.id,
            action: "imported",
            actor: "scout",
            details: asJson({ batchId, fonte: c.fonte, score: d.score }),
          },
        });
        return "inserted" as const;
      });
      if (outcome === "inserted") inserted++;
      else duplicates++;
    }
    return { inserted, duplicates };
  }

  async listCompanies(f: CompanyFilters): Promise<CompanyPage> {
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 50));
    const where: Prisma.CompanyWhereInput = { workspaceId: this.workspaceId };
    if (f.minScore !== undefined || f.maxScore !== undefined) {
      where.score = {
        ...(f.minScore !== undefined ? { gte: f.minScore } : {}),
        ...(f.maxScore !== undefined ? { lte: f.maxScore } : {}),
      };
    }
    if (f.uf) where.uf = { equals: f.uf.toUpperCase(), mode: "insensitive" };
    if (f.municipio) where.municipio = { contains: f.municipio, mode: "insensitive" };
    if (f.cnae) where.cnae = { contains: f.cnae };
    if (f.porte) where.porte = { contains: f.porte, mode: "insensitive" };
    if (f.situacao) where.situacao = { contains: f.situacao, mode: "insensitive" };
    if (f.reviewStatus) where.reviewStatus = f.reviewStatus;
    if (f.q) {
      where.OR = [
        { razaoSocial: { contains: f.q, mode: "insensitive" } },
        { nomeFantasia: { contains: f.q, mode: "insensitive" } },
        { cnpj: { contains: f.q } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: [{ score: "desc" }, { razaoSocial: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(toStoredCompany), total, page, pageSize };
  }

  async getCompany(id: string): Promise<StoredCompany | undefined> {
    const c = await this.prisma.company.findFirst({ where: { id, workspaceId: this.workspaceId } });
    return c ? toStoredCompany(c) : undefined;
  }

  async reviewCompany(id: string, decision: CompanyReviewDecision, actor: string, reason?: string): Promise<StoredCompany> {
    const existing = await this.getCompany(id);
    if (!existing) throw new Error(`empresa não encontrada: ${id}`);
    const updated = await this.prisma.$transaction(async (tx) => {
      const c = await tx.company.update({
        where: { id },
        data: {
          reviewStatus: decision,
          reviewedBy: actor,
          reviewedAt: new Date(),
          ...(reason !== undefined ? { reviewReason: reason } : {}),
        },
      });
      await tx.companyHistory.create({
        data: {
          companyId: id,
          action: `review_${decision}`,
          actor,
          ...(reason !== undefined ? { reason } : {}),
        },
      });
      return c;
    });
    return toStoredCompany(updated);
  }

  async recordHistory(
    companyId: string,
    action: string,
    actor: string,
    reason?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.companyHistory.create({
      data: {
        companyId,
        action,
        actor,
        ...(reason !== undefined ? { reason } : {}),
        ...(details !== undefined ? { details: asJson(details) } : {}),
      },
    });
  }

  async listImportBatches(limit = 50): Promise<ImportBatchRecord[]> {
    const rows = await this.prisma.importBatch.findMany({
      where: { workspaceId: this.workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((b) => ({
      id: b.id,
      fonte: b.fonte,
      ...(b.filename ? { filename: b.filename } : {}),
      ...(b.missionId ? { missionId: b.missionId } : {}),
      correlationId: b.correlationId,
      totalRows: b.totalRows,
      imported: b.imported,
      duplicates: b.duplicates,
      rejected: b.rejected,
      ...(b.rejectedDetail ? { rejectedDetail: j<{ line: number; reason: string }[]>(b.rejectedDetail) } : {}),
      importedBy: b.importedBy,
      createdAt: iso(b.createdAt),
    }));
  }

  async companyHistory(companyId: string): Promise<CompanyHistoryRecord[]> {
    const rows = await this.prisma.companyHistory.findMany({
      where: { companyId },
      orderBy: { occurredAt: "asc" },
    });
    return rows.map((h) => ({
      id: h.id,
      companyId: h.companyId,
      action: h.action,
      actor: h.actor,
      ...(h.reason ? { reason: h.reason } : {}),
      ...(h.details ? { details: j<Record<string, unknown>>(h.details) } : {}),
      occurredAt: iso(h.occurredAt),
    }));
  }
}

// ---------------------------------------------------------------- opportunities

type OpportunityRow = {
  id: string;
  workspaceId: string;
  companyId: string | null;
  leadId: string | null;
  missionId: string | null;
  stage: string;
  priority: string;
  icpScore: number;
  currentAgentId: string | null;
  nextAction: string | null;
  justification: string;
  source: string;
  approvedBy: string;
  approvedAt: Date;
  lostReason: string | null;
  ownerId: string | null;
  correlationId: string;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function toOpportunity(r: OpportunityRow): Opportunity {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    companyId: r.companyId ?? "",
    ...(r.leadId ? { leadId: r.leadId } : {}),
    ...(r.missionId ? { missionId: r.missionId } : {}),
    stage: r.stage as OpportunityStage,
    priority: r.priority as OpportunityPriority,
    icpScore: r.icpScore,
    ...(r.currentAgentId ? { currentAgentId: r.currentAgentId } : {}),
    ...(r.nextAction ? { nextAction: r.nextAction } : {}),
    justification: r.justification,
    source: r.source,
    approvedBy: r.approvedBy,
    approvedAt: iso(r.approvedAt),
    ...(r.lostReason ? { lostReason: r.lostReason } : {}),
    ...(r.ownerId ? { ownerId: r.ownerId } : {}),
    correlationId: r.correlationId,
    lastActivityAt: iso(r.lastActivityAt),
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

/**
 * OpportunityStorePort sobre PostgreSQL — transação atômica com advisory lock
 * entre Opportunity, OpportunityHistory, CompanyHistory, AuditEvent e EventOutbox.
 */
export class PrismaOpportunityStore implements OpportunityStorePort {
  constructor(private prisma: PrismaClient = defaultPrisma(), private workspaceId = "") {}

  async promoteCompany(input: PromoteCompanyInput): Promise<PromoteCompanyResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        `${this.workspaceId}:opp:${input.companyId}`,
      );

      const existing = await tx.opportunity.findUnique({
        where: { workspaceId_companyId: { workspaceId: this.workspaceId, companyId: input.companyId } },
      });
      if (existing) {
        return { opportunity: toOpportunity(existing), created: false, duplicate: true };
      }

      const company = await tx.company.findFirst({
        where: { id: input.companyId, workspaceId: this.workspaceId },
      });
      if (!company) {
        throw new Error(`empresa não encontrada: ${input.companyId}`);
      }
      if (company.reviewStatus !== "approved") {
        throw new Error(
          `empresa precisa estar aprovada na Central Scout antes de criar oportunidade comercial (status atual: ${company.reviewStatus})`,
        );
      }

      const now = new Date();
      const priority = maxPriorityForScore(company.score);
      const created = await tx.opportunity.create({
        data: {
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
          ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
          correlationId: input.correlationId,
          lastActivityAt: now,
        },
      });

      const details = {
        companyId: company.id,
        cnpj: company.cnpj,
        razaoSocial: company.razaoSocial,
        batchId: company.batchId,
        fonte: company.fonte,
        icpScore: company.score,
      };

      await tx.opportunityHistory.create({
        data: {
          opportunityId: created.id,
          toStage: "approved_target",
          action: "created",
          actor: input.approvedBy,
          reason: input.justification,
          details: asJson(details),
          correlationId: input.correlationId,
          occurredAt: now,
        },
      });

      await tx.companyHistory.create({
        data: {
          companyId: company.id,
          action: "opportunity_created",
          actor: input.approvedBy,
          reason: input.justification,
          details: asJson({ opportunityId: created.id, correlationId: input.correlationId }),
          occurredAt: now,
        },
      });

      await tx.auditEvent.create({
        data: {
          workspaceId: this.workspaceId,
          actor: input.approvedBy,
          action: "opportunity.promoted_tx",
          entity: "Opportunity",
          entityId: created.id,
          occurredAt: now,
          correlationId: input.correlationId,
          redactedPayload: asJson({
            companyId: company.id,
            stage: created.stage,
            icpScore: created.icpScore,
            source: created.source,
          }),
          outcome: "allowed",
        },
      });

      await tx.eventOutbox.upsert({
        where: { eventId: `opp_created_${created.id}` },
        update: {},
        create: {
          workspaceId: this.workspaceId,
          eventId: `opp_created_${created.id}`,
          eventType: "opportunity.created.v1",
          version: 1,
          correlationId: input.correlationId,
          agentId: "scout",
          occurredAt: now,
          payload: asJson({
            opportunityId: created.id,
            companyId: company.id,
            razaoSocial: company.razaoSocial,
            stage: created.stage,
            icpScore: created.icpScore,
            priority: created.priority,
            approvedBy: input.approvedBy,
          }),
        },
      });

      return { opportunity: toOpportunity(created), created: true, duplicate: false };
    });
  }

  async getOpportunity(id: string): Promise<Opportunity | undefined> {
    const r = await this.prisma.opportunity.findFirst({
      where: { id, workspaceId: this.workspaceId },
    });
    return r ? toOpportunity(r) : undefined;
  }

  async getOpportunityByCompany(companyId: string): Promise<Opportunity | undefined> {
    const r = await this.prisma.opportunity.findUnique({
      where: { workspaceId_companyId: { workspaceId: this.workspaceId, companyId } },
    });
    return r ? toOpportunity(r) : undefined;
  }

  async listOpportunities(f: OpportunityFilters): Promise<OpportunityPage> {
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 50));

    const grouped = await this.prisma.opportunity.groupBy({
      by: ["stage"],
      where: { workspaceId: this.workspaceId },
      _count: { stage: true },
    });
    const stageCounts: Record<string, number> = {};
    for (const g of grouped) {
      stageCounts[g.stage] = g._count.stage;
    }

    const where: Prisma.OpportunityWhereInput = { workspaceId: this.workspaceId };
    if (f.stage) where.stage = f.stage;
    if (f.currentAgentId) where.currentAgentId = f.currentAgentId;
    if (f.priority) where.priority = f.priority;
    if (f.companyId) where.companyId = f.companyId;
    if (f.minScore !== undefined || f.maxScore !== undefined) {
      where.icpScore = {
        ...(f.minScore !== undefined ? { gte: f.minScore } : {}),
        ...(f.maxScore !== undefined ? { lte: f.maxScore } : {}),
      };
    }
    if (f.q) {
      where.OR = [
        { justification: { contains: f.q, mode: "insensitive" } },
        { nextAction: { contains: f.q, mode: "insensitive" } },
        { company: { razaoSocial: { contains: f.q, mode: "insensitive" } } },
        { company: { nomeFantasia: { contains: f.q, mode: "insensitive" } } },
        { company: { cnpj: { contains: f.q } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.opportunity.count({ where }),
      this.prisma.opportunity.findMany({
        where,
        include: { company: true },
        orderBy: [{ icpScore: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: EnrichedOpportunity[] = rows.map((r) => ({
      ...toOpportunity(r),
      ...(r.company ? { company: toStoredCompany(r.company) } : {}),
    }));

    return { items, total, page, pageSize, stageCounts };
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
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.opportunity.findFirst({
        where: { id, workspaceId: this.workspaceId },
      });
      if (!existing) throw new Error(`oportunidade não encontrada: ${id}`);
      const from = existing.stage as OpportunityStage;
      assertOpportunityTransition(from, to, opts.reason);
      const now = new Date();
      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          stage: to,
          lastActivityAt: now,
          ...(opts.currentAgentId !== undefined ? { currentAgentId: opts.currentAgentId } : {}),
          ...(opts.nextAction !== undefined ? { nextAction: opts.nextAction } : {}),
          ...(opts.missionId !== undefined ? { missionId: opts.missionId } : {}),
          ...(opts.icpScore !== undefined ? { icpScore: opts.icpScore } : {}),
          ...(opts.priority !== undefined ? { priority: opts.priority } : {}),
          ...(to === "lost" || to === "archived" ? { lostReason: opts.reason ?? null } : {}),
        },
      });
      const hist = await tx.opportunityHistory.create({
        data: {
          opportunityId: id,
          fromStage: from,
          toStage: to,
          action: to === "lost" ? "lost" : to === "archived" ? "archived" : "stage_changed",
          actor,
          ...(opts.reason !== undefined ? { reason: opts.reason } : {}),
          ...(opts.details !== undefined ? { details: asJson(opts.details) } : {}),
          correlationId: opts.correlationId,
          occurredAt: now,
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: this.workspaceId,
          actor,
          action: "opportunity.stage_changed_tx",
          entity: "Opportunity",
          entityId: id,
          occurredAt: now,
          correlationId: opts.correlationId,
          redactedPayload: asJson({ fromStage: from, toStage: to, reason: opts.reason ?? null }),
          outcome: "allowed",
        },
      });
      await tx.eventOutbox.upsert({
        where: { eventId: `opp_stage_${hist.id}` },
        update: {},
        create: {
          workspaceId: this.workspaceId,
          eventId: `opp_stage_${hist.id}`,
          eventType: "opportunity.stage_changed.v1",
          version: 1,
          correlationId: opts.correlationId,
          ...(updated.missionId ? { missionId: updated.missionId } : {}),
          ...(updated.currentAgentId ? { agentId: updated.currentAgentId } : {}),
          occurredAt: now,
          payload: asJson({
            opportunityId: id,
            companyId: updated.companyId,
            fromStage: from,
            toStage: to,
            actor,
            reason: opts.reason ?? null,
          }),
        },
      });
      return toOpportunity(updated);
    });
  }

  async updateOpportunity(
    id: string,
    patch: Partial<Pick<Opportunity, "currentAgentId" | "nextAction" | "missionId" | "icpScore" | "priority" | "lostReason" | "ownerId">>,
    actor: string,
    historyEntry?: { action: string; reason?: string; details?: Record<string, unknown>; correlationId: string },
  ): Promise<Opportunity> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.opportunity.findFirst({
        where: { id, workspaceId: this.workspaceId },
      });
      if (!existing) throw new Error(`oportunidade não encontrada: ${id}`);
      const now = new Date();
      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          ...(patch.currentAgentId !== undefined ? { currentAgentId: patch.currentAgentId } : {}),
          ...(patch.nextAction !== undefined ? { nextAction: patch.nextAction } : {}),
          ...(patch.missionId !== undefined ? { missionId: patch.missionId } : {}),
          ...(patch.icpScore !== undefined ? { icpScore: patch.icpScore } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.lostReason !== undefined ? { lostReason: patch.lostReason } : {}),
          ...(patch.ownerId !== undefined ? { ownerId: patch.ownerId } : {}),
          lastActivityAt: now,
        },
      });
      if (historyEntry) {
        await tx.opportunityHistory.create({
          data: {
            opportunityId: id,
            fromStage: existing.stage,
            toStage: updated.stage,
            action: historyEntry.action,
            actor,
            ...(historyEntry.reason !== undefined ? { reason: historyEntry.reason } : {}),
            ...(historyEntry.details !== undefined ? { details: asJson(historyEntry.details) } : {}),
            correlationId: historyEntry.correlationId,
            occurredAt: now,
          },
        });
      }
      return toOpportunity(updated);
    });
  }

  async opportunityHistory(opportunityId: string): Promise<OpportunityHistory[]> {
    const rows = await this.prisma.opportunityHistory.findMany({
      where: { opportunityId },
      orderBy: { occurredAt: "asc" },
    });
    return rows.map((h) => ({
      id: h.id,
      opportunityId: h.opportunityId,
      ...(h.fromStage ? { fromStage: h.fromStage as OpportunityStage } : {}),
      toStage: h.toStage as OpportunityStage,
      action: h.action as OpportunityHistory["action"],
      actor: h.actor,
      ...(h.reason ? { reason: h.reason } : {}),
      ...(h.details ? { details: j<Record<string, unknown>>(h.details) } : {}),
      correlationId: h.correlationId,
      occurredAt: iso(h.occurredAt),
    }));
  }
}

// ---------------------------------------------------------------- costs

type UsageRow = {
  id: string; missionId: string | null; agentId: string; provider: string; model: string;
  promptKey: string | null; promptVersion: string | null; simulated: boolean;
  tokensIn: number; tokensOut: number; costUnits: number;
  estimatedCost: Prisma.Decimal | null; billedCost: Prisma.Decimal | null;
  tariffVersion: string | null; durationMs: number; status: string;
  error: string | null; correlationId: string | null; occurredAt: Date;
};

function toUsage(r: UsageRow): AiUsageRecord {
  return {
    id: r.id,
    ...(r.missionId ? { missionId: r.missionId } : {}),
    agentId: r.agentId,
    provider: r.provider,
    model: r.model,
    ...(r.promptKey ? { promptKey: r.promptKey } : {}),
    ...(r.promptVersion ? { promptVersion: r.promptVersion } : {}),
    simulated: r.simulated,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    costUnits: r.costUnits,
    estimatedCost: r.estimatedCost === null ? null : Number(r.estimatedCost),
    billedCost: r.billedCost === null ? null : Number(r.billedCost),
    tariffVersion: r.tariffVersion,
    durationMs: r.durationMs,
    status: r.status as AiUsageRecord["status"],
    ...(r.error ? { error: r.error } : {}),
    ...(r.correlationId ? { correlationId: r.correlationId } : {}),
    occurredAt: iso(r.occurredAt),
  };
}

/** CostStorePort sobre PostgreSQL — advisory lock p/ orçamento concorrente. */
export class PrismaCostStore implements CostStorePort {
  constructor(private prisma: PrismaClient = defaultPrisma(), private workspaceId = "") {}

  private usageData(rec: AiUsageRecord): Prisma.AiUsageRecordCreateInput {
    return {
      workspaceId: this.workspaceId,
      ...(rec.missionId !== undefined ? { missionId: rec.missionId } : {}),
      agentId: rec.agentId,
      provider: rec.provider,
      model: rec.model,
      ...(rec.promptKey !== undefined ? { promptKey: rec.promptKey } : {}),
      ...(rec.promptVersion !== undefined ? { promptVersion: rec.promptVersion } : {}),
      simulated: rec.simulated,
      tokensIn: rec.tokensIn,
      tokensOut: rec.tokensOut,
      costUnits: rec.costUnits,
      ...(rec.estimatedCost !== null ? { estimatedCost: new Prisma.Decimal(rec.estimatedCost) } : {}),
      ...(rec.billedCost !== null ? { billedCost: new Prisma.Decimal(rec.billedCost) } : {}),
      tariffVersion: rec.tariffVersion,
      durationMs: rec.durationMs,
      status: rec.status,
      ...(rec.error !== undefined ? { error: rec.error } : {}),
      ...(rec.correlationId !== undefined ? { correlationId: rec.correlationId } : {}),
      occurredAt: new Date(rec.occurredAt),
    };
  }

  async insertUsage(rec: AiUsageRecord): Promise<AiUsageRecord> {
    const r = await this.prisma.aiUsageRecord.create({ data: this.usageData(rec) });
    return toUsage(r);
  }

  /** Check+insert atômico: advisory lock + somas via tx (mesma conexão). */
  async insertUsageGuarded(
    rec: AiUsageRecord,
    limits: { dailyUnits?: number; monthlyUnits?: number; nowIso: string },
  ): Promise<{ record: AiUsageRecord } | { blocked: true; reason: string }> {
    const now = new Date(limits.nowIso);
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `${this.workspaceId}:budget`);
      const sumIn = async (from: Date) => {
        const agg = await tx.aiUsageRecord.aggregate({
          where: {
            workspaceId: this.workspaceId,
            simulated: false,
            status: { not: "blocked" },
            occurredAt: { gte: from, lte: now },
          },
          _sum: { costUnits: true },
        });
        return agg._sum.costUnits ?? 0;
      };
      const [dayUsed, monthUsed] = await Promise.all([sumIn(dayStart), sumIn(monthStart)]);
      if (limits.dailyUnits !== undefined && dayUsed + rec.costUnits > limits.dailyUnits) {
        return { blocked: true as const, reason: "orçamento diário excedido" };
      }
      if (limits.monthlyUnits !== undefined && monthUsed + rec.costUnits > limits.monthlyUnits) {
        return { blocked: true as const, reason: "orçamento mensal excedido" };
      }
      const r = await tx.aiUsageRecord.create({ data: this.usageData(rec) });
      return { record: toUsage(r) };
    });
  }

  async listUsage(f: UsageFilter): Promise<UsagePage> {
    const where: Prisma.AiUsageRecordWhereInput = { workspaceId: this.workspaceId };
    if (f.missionId) where.missionId = f.missionId;
    if (f.agentId) where.agentId = f.agentId;
    if (f.provider) where.provider = f.provider;
    if (f.simulated !== undefined) where.simulated = f.simulated;
    if (f.from || f.to) {
      where.occurredAt = {
        ...(f.from ? { gte: new Date(f.from) } : {}),
        ...(f.to ? { lte: new Date(f.to) } : {}),
      };
    }
    const [total, rows] = await Promise.all([
      this.prisma.aiUsageRecord.count({ where }),
      this.prisma.aiUsageRecord.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        skip: f.offset ?? 0,
        take: Math.min(500, f.limit ?? 200),
      }),
    ]);
    return { items: rows.map(toUsage), total };
  }

  private async sumUnits(fromIso: string, toIso: string, simulated: boolean): Promise<number> {
    const agg = await this.prisma.aiUsageRecord.aggregate({
      where: {
        workspaceId: this.workspaceId,
        simulated,
        occurredAt: { gte: new Date(fromIso), lte: new Date(toIso) },
      },
      _sum: { costUnits: true },
    });
    return agg._sum.costUnits ?? 0;
  }

  sumRealUnits(fromIso: string, toIso: string): Promise<number> {
    return this.sumUnits(fromIso, toIso, false);
  }

  sumSimulatedUnits(fromIso: string, toIso: string): Promise<number> {
    return this.sumUnits(fromIso, toIso, true);
  }

  async insertTariff(t: Omit<AiTariff, "id" | "createdAt">): Promise<AiTariff> {
    const r = await this.prisma.aiTariff.create({
      data: {
        version: t.version,
        provider: t.provider,
        model: t.model,
        currency: t.currency,
        inputPer1MTokens: new Prisma.Decimal(t.inputPer1MTokens),
        outputPer1MTokens: new Prisma.Decimal(t.outputPer1MTokens),
        active: t.active,
      },
    });
    return {
      id: r.id,
      version: r.version,
      provider: r.provider,
      model: r.model,
      currency: r.currency,
      inputPer1MTokens: Number(r.inputPer1MTokens),
      outputPer1MTokens: Number(r.outputPer1MTokens),
      active: r.active,
      createdAt: iso(r.createdAt),
    };
  }

  async listTariffs(): Promise<AiTariff[]> {
    const rows = await this.prisma.aiTariff.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
      id: r.id,
      version: r.version,
      provider: r.provider,
      model: r.model,
      currency: r.currency,
      inputPer1MTokens: Number(r.inputPer1MTokens),
      outputPer1MTokens: Number(r.outputPer1MTokens),
      active: r.active,
      createdAt: iso(r.createdAt),
    }));
  }

  async activeTariff(provider: string, model: string): Promise<AiTariff | undefined> {
    const r = await this.prisma.aiTariff.findFirst({
      where: { provider, model, active: true },
      orderBy: { createdAt: "desc" },
    });
    if (!r) return undefined;
    return {
      id: r.id,
      version: r.version,
      provider: r.provider,
      model: r.model,
      currency: r.currency,
      inputPer1MTokens: Number(r.inputPer1MTokens),
      outputPer1MTokens: Number(r.outputPer1MTokens),
      active: r.active,
      createdAt: iso(r.createdAt),
    };
  }
}
