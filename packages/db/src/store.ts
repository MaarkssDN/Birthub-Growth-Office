import type {
  ApprovalRequest,
  AuditEvent,
  Channel,
  CommercialDraft,
  CreateLeadInput,
  ExecutionRun,
  ExecutionStep,
  Lead,
  LeadStatus,
  Mission,
  Task,
} from "@bgo/contracts";
import { WORKSPACE_SLUG } from "@bgo/contracts";
import { Prisma, type PrismaClient } from "@prisma/client";
import { assertTransition } from "@bgo/commercial";
import type {
  AgentAssignmentRecord,
  ChannelPermissionRecord,
  NewSession,
  SessionRecord,
  StorePort,
  UserAccount,
  Workspace,
} from "@bgo/commercial";
import { prisma as defaultPrisma } from "./client";

const iso = (d: Date): string => d.toISOString();
const dt = (s: string): Date => new Date(s);
const j = <T>(v: unknown): T => v as T;
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/**
 * PrismaPersistenceAdapter — StorePort sobre PostgreSQL real (PGlite socket ou
 * Postgres nativo via DATABASE_URL). Toda mutação persiste em disco.
 */
export class PrismaStore implements StorePort {
  readonly prisma: PrismaClient;
  workspace!: Workspace;

  constructor(client?: PrismaClient) {
    this.prisma = client ?? defaultPrisma();
  }

  /** Deve ser chamado uma vez após conectar: valida identidade e carrega workspace. */
  async init(): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ db: string; version: string }[]>(
      "SELECT current_database() AS db, version() AS version",
    );
    const db = rows[0]?.db ?? "";
    // Guardrail: nunca operar sobre banco de outro produto.
    if (!/birthub_growth|postgres|template/.test(db)) {
      throw new Error(`banco inesperado: ${db} — abortando para proteger isolamento`);
    }
    // Tabela-marca de propriedade: prova que o banco pertence ao BGO.
    await this.prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "_bgo_instance" ("slug" text PRIMARY KEY, "created_at" timestamptz NOT NULL DEFAULT now())',
    );
    const marker = await this.prisma.$queryRawUnsafe<{ slug: string }[]>(
      'SELECT slug FROM "_bgo_instance" LIMIT 1',
    );
    if (marker.length > 0 && marker[0]!.slug !== WORKSPACE_SLUG) {
      throw new Error(`banco pertence a outro workspace: ${marker[0]!.slug}`);
    }
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "_bgo_instance" ("slug") VALUES ('${WORKSPACE_SLUG}') ON CONFLICT DO NOTHING`,
    );
    let ws = await this.prisma.workspace.findUnique({ where: { slug: WORKSPACE_SLUG } });
    if (!ws) {
      ws = await this.prisma.workspace.create({
        data: { slug: WORKSPACE_SLUG, name: "Birthub Growth Office", ownerId: "user_owner" },
      });
    }
    this.workspace = {
      id: ws.id,
      slug: ws.slug,
      name: ws.name,
      ownerId: ws.ownerId,
      status: ws.status,
      createdAt: iso(ws.createdAt),
    };
    await this.seedStaticData();
    await this.loadChannelPermissions();
  }

  /** Semeia usuários admin e permissões de canal de forma idempotente. */
  private async seedStaticData(): Promise<void> {
    const { hashPassword } = await import("@bgo/commercial");
    const { randomBytes } = await import("node:crypto");
    const ownerPass = process.env.BGO_ADMIN_PASSWORD ?? `bgo-${randomBytes(9).toString("base64url")}`;
    if (!process.env.BGO_ADMIN_PASSWORD) {
      console.log(`[bgo-db] senha inicial gerada para owner@bgo.local / approver@bgo.local: ${ownerPass} (defina BGO_ADMIN_PASSWORD para fixar)`);
    }
    const ownerHash = await hashPassword(ownerPass);
    const existing = await this.prisma.user.findUnique({ where: { email: "owner@bgo.local" } });
    if (!existing) {
      await this.prisma.user.create({
        data: {
          workspaceId: this.workspace.id,
          email: "owner@bgo.local",
          name: "Proprietário BGO",
          passwordHash: ownerHash,
          roleId: "owner",
        },
      });
      await this.prisma.user.create({
        data: {
          workspaceId: this.workspace.id,
          email: "approver@bgo.local",
          name: "Aprovador BGO",
          passwordHash: ownerHash,
          roleId: "approver",
        },
      });
    }
    const perms: { channel: string; optInRequired: boolean; templatesRequired: boolean; allowed: boolean }[] = [
      { channel: "internal_note", optInRequired: false, templatesRequired: false, allowed: true },
      { channel: "email", optInRequired: true, templatesRequired: false, allowed: false },
      { channel: "whatsapp", optInRequired: true, templatesRequired: true, allowed: false },
      { channel: "phone", optInRequired: true, templatesRequired: false, allowed: false },
    ];
    for (const p of perms) {
      const found = await this.prisma.channelPermission.findFirst({
        where: { workspaceId: this.workspace.id, channel: p.channel },
      });
      if (!found) {
        await this.prisma.channelPermission.create({
          data: { workspaceId: this.workspace.id, ...p },
        });
      }
    }
  }

  get workspaceSlug(): string {
    return this.workspace.slug;
  }

  // ---------- users & sessions ----------
  async findUserByEmail(email: string): Promise<UserAccount | undefined> {
    const u = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    return u ? this.toUser(u) : undefined;
  }

  async getUser(id: string): Promise<UserAccount | undefined> {
    const u = await this.prisma.user.findUnique({ where: { id } });
    return u ? this.toUser(u) : undefined;
  }

  async upsertUser(user: UserAccount): Promise<UserAccount> {
    const u = await this.prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash: user.passwordHash, roleId: user.role },
      create: {
        id: user.id,
        workspaceId: this.workspace.id,
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        roleId: user.role,
      },
    });
    return this.toUser(u);
  }

  private toUser(u: { id: string; email: string; name: string; roleId: string; passwordHash: string }): UserAccount {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.roleId as UserAccount["role"],
      passwordHash: u.passwordHash,
    };
  }

  async createSession(input: NewSession): Promise<SessionRecord> {
    const s = await this.prisma.authSession.create({
      data: {
        tokenHash: input.tokenHash,
        userId: input.userId,
        workspaceId: input.workspaceId,
        role: input.role,
        expiresAt: dt(input.expiresAt),
      },
    });
    return this.toSession(s);
  }

  async getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
    const s = await this.prisma.authSession.findUnique({ where: { tokenHash } });
    if (!s || s.revokedAt) return undefined;
    if (s.expiresAt.toISOString() < new Date().toISOString()) return undefined;
    return this.toSession(s);
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async touchSession(tokenHash: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { tokenHash },
      data: { lastSeenAt: new Date() },
    });
  }

  private toSession(s: {
    id: string; tokenHash: string; userId: string; workspaceId: string; role: string;
    createdAt: Date; expiresAt: Date; revokedAt: Date | null; lastSeenAt: Date;
  }): SessionRecord {
    return {
      id: s.id,
      tokenHash: s.tokenHash,
      userId: s.userId,
      workspaceId: s.workspaceId,
      role: s.role as SessionRecord["role"],
      createdAt: iso(s.createdAt),
      expiresAt: iso(s.expiresAt),
      ...(s.revokedAt ? { revokedAt: iso(s.revokedAt) } : {}),
      lastSeenAt: iso(s.lastSeenAt),
    };
  }

  // ---------- leads ----------
  private toLead(l: {
    id: string; workspaceId: string; source: string; sourceUrl: string | null;
    capturedAt: Date; status: string; name: string | null; email: string | null;
    phone: string | null; company: string | null; interest: string | null;
    synthetic: boolean; provenance: unknown; consent: unknown; privacy: unknown;
    dedupKey: string | null; suppressedAt: Date | null; createdBy: string;
    createdAt: Date; updatedAt: Date;
  }): Lead {
    return {
      id: l.id,
      workspaceId: l.workspaceId,
      source: l.source,
      ...(l.sourceUrl ? { sourceUrl: l.sourceUrl } : {}),
      capturedAt: iso(l.capturedAt),
      status: l.status as LeadStatus,
      ...(l.name ? { name: l.name } : {}),
      ...(l.email ? { email: l.email } : {}),
      ...(l.phone ? { phone: l.phone } : {}),
      ...(l.company ? { company: l.company } : {}),
      ...(l.interest ? { interest: l.interest } : {}),
      synthetic: l.synthetic,
      provenance: j<Lead["provenance"]>(l.provenance),
      ...(l.consent ? { consent: j<NonNullable<Lead["consent"]>>(l.consent) } : {}),
      ...(l.privacy ? { privacy: j<NonNullable<Lead["privacy"]>>(l.privacy) } : {}),
      ...(l.dedupKey ? { dedupKey: l.dedupKey } : {}),
      ...(l.suppressedAt ? { suppressedAt: iso(l.suppressedAt) } : {}),
      createdBy: l.createdBy,
      createdAt: iso(l.createdAt),
      updatedAt: iso(l.updatedAt),
    };
  }

  async createLead(input: CreateLeadInput & Partial<Lead>, actor: string): Promise<Lead> {
    const now = new Date();
    const l = await this.prisma.lead.create({
      data: {
        workspaceId: this.workspace.id,
        source: input.source,
        ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
        status: "new",
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.company !== undefined ? { company: input.company } : {}),
        ...(input.interest !== undefined ? { interest: input.interest } : {}),
        synthetic: input.synthetic,
        provenance: asJson({
          source: input.source,
          at: now.toISOString(),
          legalBasis: input.synthetic ? "dado sintético de demonstração" : "a definir na captura real",
        }),
        ...(input.consent !== undefined ? { consent: asJson(input.consent) } : {}),
        ...(input.privacy !== undefined ? { privacy: asJson(input.privacy) } : {}),
        ...(input.dedupKey !== undefined ? { dedupKey: input.dedupKey } : {}),
        createdBy: actor,
        capturedAt: now,
      },
    });
    return this.toLead(l);
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const l = await this.prisma.lead.findFirst({ where: { id, workspaceId: this.workspace.id } });
    return l ? this.toLead(l) : undefined;
  }

  async listLeads(): Promise<Lead[]> {
    const rows = await this.prisma.lead.findMany({ where: { workspaceId: this.workspace.id }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => this.toLead(r));
  }

  async findLeadByDedupKey(dedupKey: string): Promise<Lead | undefined> {
    const l = await this.prisma.lead.findFirst({ where: { workspaceId: this.workspace.id, dedupKey } });
    return l ? this.toLead(l) : undefined;
  }

  async transitionLead(id: string, to: LeadStatus, _actor: string): Promise<Lead> {
    const lead = await this.getLead(id);
    if (!lead) throw new Error(`lead não encontrado: ${id}`);
    assertTransition(lead.status, to);
    const l = await this.prisma.lead.update({ where: { id }, data: { status: to } });
    return this.toLead(l);
  }

  async updateLead(id: string, patch: Partial<Lead>): Promise<Lead> {
    const { provenance, consent, privacy, ...rest } = patch;
    const data: Record<string, unknown> = { ...rest };
    if (provenance !== undefined) data.provenance = asJson(provenance);
    if (consent !== undefined) data.consent = asJson(consent);
    if (privacy !== undefined) data.privacy = asJson(privacy);
    const l = await this.prisma.lead.update({ where: { id }, data });
    return this.toLead(l);
  }

  // ---------- missions & tasks ----------
  private toMission(m: {
    id: string; workspaceId: string; leadId: string | null; requester: string; goal: string;
    status: string; correlationId: string; createdBy: string; createdAt: Date; updatedAt: Date;
  }): Mission {
    return {
      id: m.id,
      workspaceId: m.workspaceId,
      ...(m.leadId ? { leadId: m.leadId } : {}),
      requester: m.requester,
      goal: m.goal,
      status: m.status as Mission["status"],
      correlationId: m.correlationId,
      createdBy: m.createdBy,
      createdAt: iso(m.createdAt),
      updatedAt: iso(m.updatedAt),
    };
  }

  async createMission(input: {
    goal: string; requester: string; leadId?: string; correlationId: string; createdBy: string;
  }): Promise<Mission> {
    const m = await this.prisma.mission.create({
      data: {
        workspaceId: this.workspace.id,
        ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
        requester: input.requester,
        goal: input.goal,
        status: "draft",
        correlationId: input.correlationId,
        createdBy: input.createdBy,
      },
    });
    return this.toMission(m);
  }

  async getMission(id: string): Promise<Mission | undefined> {
    const m = await this.prisma.mission.findFirst({ where: { id, workspaceId: this.workspace.id } });
    return m ? this.toMission(m) : undefined;
  }

  async listMissions(): Promise<Mission[]> {
    const rows = await this.prisma.mission.findMany({ where: { workspaceId: this.workspace.id }, orderBy: { createdAt: "desc" } });
    return rows.map((r) => this.toMission(r));
  }

  async setMissionStatus(id: string, status: Mission["status"]): Promise<Mission> {
    const m = await this.prisma.mission.update({ where: { id }, data: { status } });
    return this.toMission(m);
  }

  private toTask(t: {
    id: string; missionId: string; assigneeId: string; title: string; status: string;
    dueAt: Date | null; dependsOn: string[]; correlationId: string;
  }): Task {
    return {
      id: t.id,
      missionId: t.missionId,
      assigneeId: t.assigneeId,
      title: t.title,
      status: t.status as Task["status"],
      ...(t.dueAt ? { dueAt: iso(t.dueAt) } : {}),
      dependsOn: t.dependsOn,
      correlationId: t.correlationId,
    };
  }

  async createTask(input: {
    missionId: string; assigneeId: string; title: string; correlationId: string;
    dueAt?: string; dependsOn?: string[];
  }): Promise<Task> {
    const t = await this.prisma.task.create({
      data: {
        workspaceId: this.workspace.id,
        missionId: input.missionId,
        assigneeId: input.assigneeId,
        title: input.title,
        status: "assigned",
        ...(input.dueAt !== undefined ? { dueAt: dt(input.dueAt) } : {}),
        dependsOn: input.dependsOn ?? [],
        correlationId: input.correlationId,
      },
    });
    return this.toTask(t);
  }

  async listTasks(missionId?: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { workspaceId: this.workspace.id, ...(missionId ? { missionId } : {}) },
    });
    return rows.map((r) => this.toTask(r));
  }

  async setTaskStatus(id: string, status: Task["status"]): Promise<Task> {
    const t = await this.prisma.task.update({ where: { id }, data: { status } });
    return this.toTask(t);
  }

  private toAssignment(a: {
    id: string; missionId: string; agentId: string; role: string; assignedBy: string; assignedAt: Date;
  }): AgentAssignmentRecord {
    return {
      id: a.id,
      missionId: a.missionId,
      agentId: a.agentId,
      role: a.role,
      assignedBy: a.assignedBy,
      assignedAt: iso(a.assignedAt),
    };
  }

  async assign(missionId: string, agentId: string, role: string, assignedBy: string): Promise<AgentAssignmentRecord> {
    const a = await this.prisma.agentAssignment.create({
      data: { workspaceId: this.workspace.id, missionId, agentId, role, assignedBy },
    });
    return this.toAssignment(a);
  }

  async listAssignments(missionId?: string): Promise<AgentAssignmentRecord[]> {
    const rows = await this.prisma.agentAssignment.findMany({
      where: { workspaceId: this.workspace.id, ...(missionId ? { missionId } : {}) },
    });
    return rows.map((r) => this.toAssignment(r));
  }

  // ---------- runs & steps ----------
  private toRun(r: {
    id: string; missionId: string; agentId: string; provider: string; mock: boolean;
    status: string; costUnits: number; correlationId: string; error: string | null;
    createdAt: Date; updatedAt: Date;
  }): ExecutionRun {
    return {
      id: r.id,
      missionId: r.missionId,
      agentId: r.agentId,
      provider: r.provider,
      mock: r.mock,
      status: r.status as ExecutionRun["status"],
      costUnits: r.costUnits,
      correlationId: r.correlationId,
      ...(r.error ? { error: r.error } : {}),
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    };
  }

  async createRun(input: {
    missionId: string; agentId: string; correlationId: string; provider?: string;
  }): Promise<ExecutionRun> {
    const r = await this.prisma.executionRun.create({
      data: {
        workspaceId: this.workspace.id,
        missionId: input.missionId,
        agentId: input.agentId,
        correlationId: input.correlationId,
        provider: input.provider ?? "mock",
        mock: true,
        status: "queued",
      },
    });
    return this.toRun(r);
  }

  async getRun(id: string): Promise<ExecutionRun | undefined> {
    const r = await this.prisma.executionRun.findFirst({ where: { id, workspaceId: this.workspace.id } });
    return r ? this.toRun(r) : undefined;
  }

  async listRuns(missionId?: string): Promise<ExecutionRun[]> {
    const rows = await this.prisma.executionRun.findMany({
      where: { workspaceId: this.workspace.id, ...(missionId ? { missionId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toRun(r));
  }

  async setRunStatus(id: string, status: ExecutionRun["status"], error?: string): Promise<ExecutionRun> {
    const r = await this.prisma.executionRun.update({
      where: { id },
      data: { status, ...(error !== undefined ? { error } : {}) },
    });
    return this.toRun(r);
  }

  private toStep(s: {
    id: string; runId: string; seq: number; tool: string; action: string;
    inputRef: string | null; outputRef: string | null; decision: unknown; createdAt: Date;
  }): ExecutionStep {
    return {
      id: s.id,
      runId: s.runId,
      seq: s.seq,
      tool: s.tool,
      action: s.action,
      ...(s.inputRef ? { inputRef: s.inputRef } : {}),
      ...(s.outputRef ? { outputRef: s.outputRef } : {}),
      ...(s.decision ? { decision: j<Record<string, unknown>>(s.decision) } : {}),
      createdAt: iso(s.createdAt),
    };
  }

  async addStep(input: {
    runId: string; tool: string; action: string;
    inputRef?: string; outputRef?: string; decision?: Record<string, unknown>;
  }): Promise<ExecutionStep> {
    const count = await this.prisma.executionStep.count({ where: { runId: input.runId } });
    const s = await this.prisma.executionStep.create({
      data: {
        runId: input.runId,
        seq: count + 1,
        tool: input.tool,
        action: input.action,
        ...(input.inputRef !== undefined ? { inputRef: input.inputRef } : {}),
        ...(input.outputRef !== undefined ? { outputRef: input.outputRef } : {}),
        ...(input.decision !== undefined ? { decision: asJson(input.decision) } : {}),
      },
    });
    return this.toStep(s);
  }

  async listSteps(runId?: string): Promise<ExecutionStep[]> {
    const rows = await this.prisma.executionStep.findMany({
      where: runId ? { runId } : {},
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => this.toStep(r));
  }

  // ---------- approvals ----------
  private toApproval(a: {
    id: string; missionId: string; action: string; scope: string; reason: string;
    preview: unknown; requestedBy: string; approverRole: string; status: string;
    decision: string | null; decidedBy: string | null; decidedAt: Date | null;
    decidedReason: string | null; expiresAt: Date | null; correlationId: string; createdAt: Date;
  }): ApprovalRequest {
    return {
      id: a.id,
      missionId: a.missionId,
      action: a.action,
      scope: a.scope,
      reason: a.reason,
      preview: j<Record<string, unknown>>(a.preview),
      requestedBy: a.requestedBy,
      approverRole: a.approverRole,
      status: a.status as ApprovalRequest["status"],
      ...(a.decision ? { decision: a.decision } : {}),
      ...(a.decidedBy ? { decidedBy: a.decidedBy } : {}),
      ...(a.decidedAt ? { decidedAt: iso(a.decidedAt) } : {}),
      ...(a.decidedReason ? { decidedReason: a.decidedReason } : {}),
      ...(a.expiresAt ? { expiresAt: iso(a.expiresAt) } : {}),
      correlationId: a.correlationId,
      createdAt: iso(a.createdAt),
    };
  }

  async createApproval(input: {
    missionId: string; action: string; scope: string; reason: string;
    preview: Record<string, unknown>; requestedBy: string; approverRole: string;
    correlationId: string; expiresAt?: string;
  }): Promise<ApprovalRequest> {
    const a = await this.prisma.approvalRequest.create({
      data: {
        workspaceId: this.workspace.id,
        missionId: input.missionId,
        action: input.action,
        scope: input.scope,
        reason: input.reason,
        preview: asJson(input.preview),
        requestedBy: input.requestedBy,
        approverRole: input.approverRole,
        correlationId: input.correlationId,
        ...(input.expiresAt !== undefined ? { expiresAt: dt(input.expiresAt) } : {}),
      },
    });
    return this.toApproval(a);
  }

  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    const a = await this.prisma.approvalRequest.findFirst({ where: { id, workspaceId: this.workspace.id } });
    return a ? this.toApproval(a) : undefined;
  }

  async listApprovals(status?: ApprovalRequest["status"]): Promise<ApprovalRequest[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { workspaceId: this.workspace.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toApproval(r));
  }

  async decideApproval(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason?: string,
  ): Promise<ApprovalRequest> {
    const a = await this.getApproval(id);
    if (!a) throw new Error(`approval não encontrada: ${id}`);
    if (a.status !== "pending") throw new Error(`approval ${id} já decidida (${a.status})`);
    if (a.expiresAt && a.expiresAt < new Date().toISOString()) {
      await this.prisma.approvalRequest.update({ where: { id }, data: { status: "expired" } });
      throw new Error("approval expirada");
    }
    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: decision,
        decision,
        decidedBy,
        decidedAt: new Date(),
        ...(reason !== undefined ? { decidedReason: reason } : {}),
      },
    });
    return this.toApproval(updated);
  }

  // ---------- drafts ----------
  private toDraft(d: {
    id: string; missionId: string | null; channel: string; recipientPolicy: string;
    template: string | null; claimRefs: string[]; text: string; status: string;
    simulated: boolean; createdBy: string; createdAt: Date; updatedAt: Date;
  }): CommercialDraft {
    return {
      id: d.id,
      ...(d.missionId ? { missionId: d.missionId } : {}),
      channel: d.channel as Channel,
      recipientPolicy: d.recipientPolicy,
      ...(d.template ? { template: d.template } : {}),
      claimRefs: d.claimRefs,
      text: d.text,
      status: d.status as CommercialDraft["status"],
      simulated: d.simulated,
      createdBy: d.createdBy,
      createdAt: iso(d.createdAt),
      updatedAt: iso(d.updatedAt),
    };
  }

  async createDraft(input: {
    missionId?: string; leadId?: string; channel: Channel; recipientPolicy: string;
    template?: string; claimRefs: string[]; text: string; createdBy: string;
  }): Promise<CommercialDraft> {
    const d = await this.prisma.commercialDraft.create({
      data: {
        workspaceId: this.workspace.id,
        ...(input.missionId !== undefined ? { missionId: input.missionId } : {}),
        channel: input.channel,
        recipientPolicy: input.recipientPolicy,
        ...(input.template !== undefined ? { template: input.template } : {}),
        claimRefs: input.claimRefs,
        text: input.text,
        simulated: true,
        createdBy: input.createdBy,
      },
    });
    return this.toDraft(d);
  }

  async getDraft(id: string): Promise<CommercialDraft | undefined> {
    const d = await this.prisma.commercialDraft.findFirst({ where: { id, workspaceId: this.workspace.id } });
    return d ? this.toDraft(d) : undefined;
  }

  async listDrafts(): Promise<CommercialDraft[]> {
    const rows = await this.prisma.commercialDraft.findMany({
      where: { workspaceId: this.workspace.id },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDraft(r));
  }

  async setDraftStatus(id: string, status: CommercialDraft["status"]): Promise<CommercialDraft> {
    const d = await this.prisma.commercialDraft.update({ where: { id }, data: { status } });
    return this.toDraft(d);
  }

  // ---------- channel permissions ----------
  channelPermission(channel: Channel): ChannelPermissionRecord {
    // versão síncrona exigida pela interface: usa cache populado no init.
    const cached = this.permCache.get(channel);
    if (!cached) throw new Error(`permissão de canal não carregada: ${channel}`);
    return cached;
  }

  private permCache = new Map<Channel, ChannelPermissionRecord>();

  async loadChannelPermissions(): Promise<void> {
    const rows = await this.prisma.channelPermission.findMany({ where: { workspaceId: this.workspace.id } });
    for (const r of rows) {
      this.permCache.set(r.channel as Channel, {
        channel: r.channel as Channel,
        optInRequired: r.optInRequired,
        templatesRequired: r.templatesRequired,
        allowed: r.allowed,
      });
    }
  }

  // ---------- audit ----------
  async appendAudit(event: AuditEvent): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        id: event.id,
        workspaceId: this.workspace.id,
        actor: event.actor,
        action: event.action,
        entity: event.entity,
        entityId: event.entityId,
        occurredAt: dt(event.occurredAt),
        correlationId: event.correlationId,
        ...(event.redactedPayload !== undefined ? { redactedPayload: asJson(event.redactedPayload) } : {}),
        outcome: event.outcome,
      },
    });
  }

  async listAudit(filter?: { correlationId?: string; outcome?: AuditEvent["outcome"]; limit?: number }): Promise<AuditEvent[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        workspaceId: this.workspace.id,
        ...(filter?.correlationId ? { correlationId: filter.correlationId } : {}),
        ...(filter?.outcome ? { outcome: filter.outcome } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: filter?.limit ?? 500,
    });
    return rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      occurredAt: iso(r.occurredAt),
      correlationId: r.correlationId,
      ...(r.redactedPayload ? { redactedPayload: r.redactedPayload as Record<string, unknown> } : {}),
      outcome: r.outcome as AuditEvent["outcome"],
    }));
  }

  // ---------- events outbox (persistência de eventos p/ G11) ----------
  async persistEvent(event: {
    eventId: string; eventType: string; version: number; correlationId: string;
    missionId?: string; agentId?: string; occurredAt: string; payload: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.eventOutbox.upsert({
      where: { eventId: event.eventId },
      update: {},
      create: {
        workspaceId: this.workspace.id,
        eventId: event.eventId,
        eventType: event.eventType,
        version: event.version,
        correlationId: event.correlationId,
        ...(event.missionId !== undefined ? { missionId: event.missionId } : {}),
        ...(event.agentId !== undefined ? { agentId: event.agentId } : {}),
        occurredAt: dt(event.occurredAt),
        payload: asJson(event.payload),
      },
    });
  }

  async listPersistedEvents(filter?: { correlationId?: string; limit?: number }) {
    const rows = await this.prisma.eventOutbox.findMany({
      where: { workspaceId: this.workspace.id, ...(filter?.correlationId ? { correlationId: filter.correlationId } : {}) },
      orderBy: { occurredAt: "asc" },
      take: filter?.limit ?? 500,
    });
    return rows.map((r) => ({
      eventId: r.eventId,
      eventType: r.eventType,
      version: r.version,
      workspaceId: this.workspace.slug,
      ...(r.missionId ? { missionId: r.missionId } : {}),
      ...(r.agentId ? { agentId: r.agentId } : {}),
      occurredAt: iso(r.occurredAt),
      correlationId: r.correlationId,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  /** Outbox publisher (G53): eventos persistidos ainda não entregues. */
  async listUnpublishedEvents(limit = 100) {
    const rows = await this.prisma.eventOutbox.findMany({
      where: { workspaceId: this.workspace.id, publishedAt: null },
      orderBy: { occurredAt: "asc" },
      take: limit,
    });
    return rows.map((r) => ({
      eventId: r.eventId,
      eventType: r.eventType,
      version: r.version,
      workspaceId: this.workspace.slug,
      ...(r.missionId ? { missionId: r.missionId } : {}),
      ...(r.agentId ? { agentId: r.agentId } : {}),
      occurredAt: iso(r.occurredAt),
      correlationId: r.correlationId,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async markEventPublished(eventId: string): Promise<void> {
    await this.prisma.eventOutbox.updateMany({
      where: { eventId, publishedAt: null },
      data: { publishedAt: new Date() },
    });
  }
}

