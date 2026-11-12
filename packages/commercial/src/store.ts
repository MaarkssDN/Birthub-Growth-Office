import { randomUUID } from "node:crypto";
import type {
  ApprovalRequest,
  AuditEvent,
  Channel,
  CommercialDraft,
  CreateLeadInput,
  ExecutionRun,
  ExecutionStep,
  Lead,
  Mission,
  Task,
} from "@bgo/contracts";
import { WORKSPACE_SLUG } from "@bgo/contracts";
import type { LeadStatus } from "@bgo/contracts";
import { assertTransition } from "./lead-machine";
import type {
  AgentAssignmentRecord,
  ChannelPermissionRecord,
  NewSession,
  SessionRecord,
  StorePort,
  UserAccount,
  Workspace,
} from "./store-port";



/**
 * Persistência in-memory da Onda 01 (volátil, single-process).
 * Implementa StorePort — mesma superfície do PrismaStore (packages/db).
 * Usada em dev sem DATABASE_URL e em testes.
 */
export class Store implements StorePort {
  readonly workspace: Workspace;
  readonly users = new Map<string, UserAccount>();
  readonly leads = new Map<string, Lead>();
  readonly missions = new Map<string, Mission>();
  readonly tasks = new Map<string, Task>();
  readonly runs = new Map<string, ExecutionRun>();
  readonly steps: ExecutionStep[] = [];
  readonly approvals = new Map<string, ApprovalRequest>();
  readonly drafts = new Map<string, CommercialDraft>();
  readonly assignments = new Map<string, AgentAssignmentRecord>();
  readonly sessions = new Map<string, SessionRecord>(); // key: tokenHash
  readonly channelPermissions = new Map<Channel, ChannelPermissionRecord>();
  private auditLog: AuditEvent[] = [];

  constructor() {
    const now = new Date().toISOString();
    this.workspace = {
      id: "ws_birthub_growth",
      slug: WORKSPACE_SLUG,
      name: "Birthub Growth Office",
      ownerId: "user_owner",
      status: "active",
      createdAt: now,
    };
    this.users.set("user_owner", {
      id: "user_owner",
      email: "owner@bgo.local",
      name: "Proprietário BGO",
      role: "owner",
      passwordHash: "seed-no-real-auth",
    });
    this.users.set("user_approver", {
      id: "user_approver",
      email: "approver@bgo.local",
      name: "Aprovador BGO",
      role: "approver",
      passwordHash: "seed-no-real-auth",
    });
    for (const channel of ["email", "whatsapp", "phone", "internal_note"] as Channel[]) {
      this.channelPermissions.set(channel, {
        channel,
        optInRequired: channel !== "internal_note",
        templatesRequired: channel === "whatsapp",
        allowed: channel === "internal_note",
      });
    }
  }

  get workspaceSlug(): string {
    return this.workspace.slug;
  }

  // ---------- users & sessions ----------
  async findUserByEmail(email: string): Promise<UserAccount | undefined> {
    const normalized = email.trim().toLowerCase();
    return [...this.users.values()].find((u) => u.email.toLowerCase() === normalized);
  }

  async getUser(id: string): Promise<UserAccount | undefined> {
    return this.users.get(id);
  }

  async upsertUser(user: UserAccount): Promise<UserAccount> {
    this.users.set(user.id, user);
    return user;
  }

  async createSession(input: NewSession): Promise<SessionRecord> {
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id: randomUUID(),
      tokenHash: input.tokenHash,
      userId: input.userId,
      workspaceId: input.workspaceId,
      role: input.role,
      createdAt: now,
      expiresAt: input.expiresAt,
      lastSeenAt: now,
    };
    this.sessions.set(input.tokenHash, session);
    return session;
  }

  async getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | undefined> {
    const s = this.sessions.get(tokenHash);
    if (!s || s.revokedAt || s.expiresAt < new Date().toISOString()) return undefined;
    return s;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    const s = this.sessions.get(tokenHash);
    if (s) this.sessions.set(tokenHash, { ...s, revokedAt: new Date().toISOString() });
  }

  async touchSession(tokenHash: string): Promise<void> {
    const s = this.sessions.get(tokenHash);
    if (s) this.sessions.set(tokenHash, { ...s, lastSeenAt: new Date().toISOString() });
  }

  // ---------- leads ----------
  async createLead(input: CreateLeadInput & Partial<Lead>, actor: string): Promise<Lead> {
    const now = new Date().toISOString();
    const lead: Lead = {
      id: randomUUID(),
      workspaceId: this.workspace.id,
      source: input.source,
      ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
      capturedAt: now,
      status: "new",
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.company !== undefined ? { company: input.company } : {}),
      ...(input.interest !== undefined ? { interest: input.interest } : {}),
      synthetic: input.synthetic,
      provenance: {
        source: input.source,
        at: now,
        legalBasis: input.synthetic ? "dado sintético de demonstração" : "a definir na captura real",
      },
      ...(input.consent !== undefined ? { consent: input.consent } : {}),
      ...(input.privacy !== undefined ? { privacy: input.privacy } : {}),
      ...(input.dedupKey !== undefined ? { dedupKey: input.dedupKey } : {}),
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async listLeads(): Promise<Lead[]> {
    return [...this.leads.values()];
  }

  async findLeadByDedupKey(dedupKey: string): Promise<Lead | undefined> {
    return [...this.leads.values()].find((l) => l.dedupKey === dedupKey);
  }

  async transitionLead(id: string, to: LeadStatus, actor: string): Promise<Lead> {
    const lead = this.leads.get(id);
    if (!lead) throw new Error(`lead não encontrado: ${id}`);
    assertTransition(lead.status, to);
    const updated: Lead = { ...lead, status: to, updatedAt: new Date().toISOString() };
    this.leads.set(id, updated);
    void actor;
    return updated;
  }

  async updateLead(id: string, patch: Partial<Lead>): Promise<Lead> {
    const lead = this.leads.get(id);
    if (!lead) throw new Error(`lead não encontrado: ${id}`);
    const updated: Lead = { ...lead, ...patch, id: lead.id, updatedAt: new Date().toISOString() };
    this.leads.set(id, updated);
    return updated;
  }

  // ---------- missions & tasks ----------
  async createMission(input: {
    goal: string;
    requester: string;
    leadId?: string;
    correlationId: string;
    createdBy: string;
  }): Promise<Mission> {
    const now = new Date().toISOString();
    const mission: Mission = {
      id: randomUUID(),
      workspaceId: this.workspace.id,
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
      requester: input.requester,
      goal: input.goal,
      status: "draft",
      correlationId: input.correlationId,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.missions.set(mission.id, mission);
    return mission;
  }

  async getMission(id: string): Promise<Mission | undefined> {
    return this.missions.get(id);
  }

  async listMissions(): Promise<Mission[]> {
    return [...this.missions.values()];
  }

  async setMissionStatus(id: string, status: Mission["status"]): Promise<Mission> {
    const m = this.missions.get(id);
    if (!m) throw new Error(`missão não encontrada: ${id}`);
    const updated = { ...m, status, updatedAt: new Date().toISOString() };
    this.missions.set(id, updated);
    return updated;
  }

  async createTask(input: {
    missionId: string;
    assigneeId: string;
    title: string;
    correlationId: string;
    dueAt?: string;
    dependsOn?: string[];
  }): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      missionId: input.missionId,
      assigneeId: input.assigneeId,
      title: input.title,
      status: "assigned",
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      dependsOn: input.dependsOn ?? [],
      correlationId: input.correlationId,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async listTasks(missionId?: string): Promise<Task[]> {
    const all = [...this.tasks.values()];
    return missionId ? all.filter((t) => t.missionId === missionId) : all;
  }

  async setTaskStatus(id: string, status: Task["status"]): Promise<Task> {
    const t = this.tasks.get(id);
    if (!t) throw new Error(`task não encontrada: ${id}`);
    const updated = { ...t, status };
    this.tasks.set(id, updated);
    return updated;
  }

  async assign(missionId: string, agentId: string, role: string, assignedBy: string): Promise<AgentAssignmentRecord> {
    const a: AgentAssignmentRecord = {
      id: randomUUID(),
      missionId,
      agentId,
      role,
      assignedBy,
      assignedAt: new Date().toISOString(),
    };
    this.assignments.set(a.id, a);
    return a;
  }

  async listAssignments(missionId?: string): Promise<AgentAssignmentRecord[]> {
    const all = [...this.assignments.values()];
    return missionId ? all.filter((a) => a.missionId === missionId) : all;
  }

  // ---------- runs & steps ----------
  async createRun(input: {
    missionId: string;
    agentId: string;
    correlationId: string;
    provider?: string;
  }): Promise<ExecutionRun> {
    const now = new Date().toISOString();
    const run: ExecutionRun = {
      id: randomUUID(),
      missionId: input.missionId,
      agentId: input.agentId,
      provider: input.provider ?? "mock",
      mock: true,
      status: "queued",
      costUnits: 0,
      correlationId: input.correlationId,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.id, run);
    return run;
  }

  async getRun(id: string): Promise<ExecutionRun | undefined> {
    return this.runs.get(id);
  }

  async listRuns(missionId?: string): Promise<ExecutionRun[]> {
    const all = [...this.runs.values()];
    return missionId ? all.filter((r) => r.missionId === missionId) : all;
  }

  async setRunStatus(id: string, status: ExecutionRun["status"], error?: string): Promise<ExecutionRun> {
    const r = this.runs.get(id);
    if (!r) throw new Error(`run não encontrada: ${id}`);
    const updated: ExecutionRun = {
      ...r,
      status,
      updatedAt: new Date().toISOString(),
      ...(error !== undefined ? { error } : {}),
    };
    this.runs.set(id, updated);
    return updated;
  }

  async addStep(input: {
    runId: string;
    tool: string;
    action: string;
    inputRef?: string;
    outputRef?: string;
    decision?: Record<string, unknown>;
  }): Promise<ExecutionStep> {
    const runSteps = this.steps.filter((s) => s.runId === input.runId);
    const step: ExecutionStep = {
      id: randomUUID(),
      runId: input.runId,
      seq: runSteps.length + 1,
      tool: input.tool,
      action: input.action,
      ...(input.inputRef !== undefined ? { inputRef: input.inputRef } : {}),
      ...(input.outputRef !== undefined ? { outputRef: input.outputRef } : {}),
      ...(input.decision !== undefined ? { decision: input.decision } : {}),
      createdAt: new Date().toISOString(),
    };
    this.steps.push(step);
    return step;
  }

  async listSteps(runId?: string): Promise<ExecutionStep[]> {
    return runId ? this.steps.filter((s) => s.runId === runId) : this.steps;
  }

  // ---------- approvals ----------
  async createApproval(input: {
    missionId: string;
    action: string;
    scope: string;
    reason: string;
    preview: Record<string, unknown>;
    requestedBy: string;
    approverRole: string;
    correlationId: string;
    expiresAt?: string;
  }): Promise<ApprovalRequest> {
    const now = new Date().toISOString();
    const approval: ApprovalRequest = {
      id: randomUUID(),
      missionId: input.missionId,
      action: input.action,
      scope: input.scope,
      reason: input.reason,
      preview: input.preview,
      requestedBy: input.requestedBy,
      approverRole: input.approverRole,
      status: "pending",
      correlationId: input.correlationId,
      createdAt: now,
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    return this.approvals.get(id);
  }

  async listApprovals(status?: ApprovalRequest["status"]): Promise<ApprovalRequest[]> {
    const all = [...this.approvals.values()];
    return status ? all.filter((a) => a.status === status) : all;
  }

  async decideApproval(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason?: string,
  ): Promise<ApprovalRequest> {
    const a = this.approvals.get(id);
    if (!a) throw new Error(`approval não encontrada: ${id}`);
    if (a.status !== "pending") throw new Error(`approval ${id} já decidida (${a.status})`);
    if (a.expiresAt && a.expiresAt < new Date().toISOString()) {
      const expired = { ...a, status: "expired" as const };
      this.approvals.set(id, expired);
      throw new Error("approval expirada");
    }
    const updated: ApprovalRequest = {
      ...a,
      status: decision,
      decision,
      decidedBy,
      decidedAt: new Date().toISOString(),
      ...(reason !== undefined ? { decidedReason: reason } : {}),
    };
    this.approvals.set(id, updated);
    return updated;
  }

  // ---------- drafts ----------
  async createDraft(input: {
    missionId?: string;
    leadId?: string;
    channel: Channel;
    recipientPolicy: string;
    template?: string;
    claimRefs: string[];
    text: string;
    createdBy: string;
  }): Promise<CommercialDraft> {
    const now = new Date().toISOString();
    const draft: CommercialDraft = {
      id: randomUUID(),
      ...(input.missionId !== undefined ? { missionId: input.missionId } : {}),
      ...(input.leadId !== undefined ? { leadId: input.leadId } : {}),
      channel: input.channel,
      recipientPolicy: input.recipientPolicy,
      ...(input.template !== undefined ? { template: input.template } : {}),
      claimRefs: input.claimRefs,
      text: input.text,
      status: "draft",
      simulated: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  async getDraft(id: string): Promise<CommercialDraft | undefined> {
    return this.drafts.get(id);
  }

  async listDrafts(): Promise<CommercialDraft[]> {
    return [...this.drafts.values()];
  }

  async setDraftStatus(id: string, status: CommercialDraft["status"]): Promise<CommercialDraft> {
    const d = this.drafts.get(id);
    if (!d) throw new Error(`draft não encontrado: ${id}`);
    const updated = { ...d, status, updatedAt: new Date().toISOString() };
    this.drafts.set(id, updated);
    return updated;
  }

  // ---------- channel permissions ----------
  channelPermission(channel: Channel): ChannelPermissionRecord {
    const p = this.channelPermissions.get(channel);
    if (!p) throw new Error(`canal desconhecido: ${channel}`);
    return p;
  }

  // ---------- audit ----------
  async appendAudit(event: AuditEvent): Promise<void> {
    this.auditLog.push(event);
  }

  async listAudit(filter?: { correlationId?: string; outcome?: AuditEvent["outcome"]; limit?: number }): Promise<AuditEvent[]> {
    let out = this.auditLog;
    if (filter?.correlationId) out = out.filter((a) => a.correlationId === filter.correlationId);
    if (filter?.outcome) out = out.filter((a) => a.outcome === filter.outcome);
    return out.slice(-(filter?.limit ?? 500));
  }
}
