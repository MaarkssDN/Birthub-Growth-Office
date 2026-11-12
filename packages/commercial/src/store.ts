import { randomUUID } from "node:crypto";
import type {
  AgentAssignmentLike,
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
} from "./types";
import { WORKSPACE_SLUG } from "@bgo/contracts";
import { assertTransition } from "./lead-machine";
import type { LeadStatus } from "@bgo/contracts";

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  status: string;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: "owner" | "operator" | "approver" | "auditor";
  passwordHash: string;
}

export interface ChannelPermissionRecord {
  channel: Channel;
  optInRequired: boolean;
  templatesRequired: boolean;
  allowed: boolean;
}

interface StoredAgentAssignment {
  id: string;
  missionId: string;
  agentId: string;
  role: string;
  assignedBy: string;
  assignedAt: string;
}

/**
 * Persistência in-memory da Onda 00 (volátil, single-process).
 * Substituível por PrismaPersistenceAdapter quando Docker estiver seguro —
 * mesma superfície de métodos, ver ADR-003.
 */
export class Store {
  readonly workspace: Workspace;
  readonly users = new Map<string, UserAccount>();
  readonly leads = new Map<string, Lead>();
  readonly missions = new Map<string, Mission>();
  readonly tasks = new Map<string, Task>();
  readonly runs = new Map<string, ExecutionRun>();
  readonly steps: ExecutionStep[] = [];
  readonly approvals = new Map<string, ApprovalRequest>();
  readonly drafts = new Map<string, CommercialDraft>();
  readonly assignments = new Map<string, StoredAgentAssignment>();
  readonly channelPermissions = new Map<Channel, ChannelPermissionRecord>();
  private audit: AuditEvent[] = [];

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
      passwordHash: "seed-no-real-auth", // auth real é Onda 01; W00 usa token fixo de dev
    });
    this.users.set("user_approver", {
      id: "user_approver",
      email: "approver@bgo.local",
      name: "Aprovador BGO",
      role: "approver",
      passwordHash: "seed-no-real-auth",
    });
    // Canais externos NUNCA permitidos na Onda 00.
    for (const channel of ["email", "whatsapp", "phone", "internal_note"] as Channel[]) {
      this.channelPermissions.set(channel, {
        channel,
        optInRequired: channel !== "internal_note",
        templatesRequired: channel === "whatsapp",
        allowed: channel === "internal_note", // somente nota interna é "canal permitido"
      });
    }
  }

  // ---------- Leads ----------
  createLead(input: CreateLeadInput, actor: string): Lead {
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
      synthetic: input.synthetic,
      provenance: {
        source: input.source,
        at: now,
        legalBasis: input.synthetic ? "dado sintético de demonstração" : "a definir na captura real",
      },
      ...(input.consent !== undefined ? { consent: input.consent } : {}),
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
    };
    this.leads.set(lead.id, lead);
    return lead;
  }

  getLead(id: string): Lead | undefined {
    return this.leads.get(id);
  }

  listLeads(): Lead[] {
    return [...this.leads.values()];
  }

  transitionLead(id: string, to: LeadStatus, actor: string): Lead {
    const lead = this.leads.get(id);
    if (!lead) throw new Error(`lead não encontrado: ${id}`);
    assertTransition(lead.status, to);
    const from = lead.status;
    const updated: Lead = { ...lead, status: to, updatedAt: new Date().toISOString() };
    this.leads.set(id, updated);
    void actor;
    void from;
    return updated;
  }

  // ---------- Missions / Tasks ----------
  createMission(input: {
    goal: string;
    requester: string;
    leadId?: string;
    correlationId: string;
    createdBy: string;
  }): Mission {
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

  getMission(id: string): Mission | undefined {
    return this.missions.get(id);
  }

  listMissions(): Mission[] {
    return [...this.missions.values()];
  }

  setMissionStatus(id: string, status: Mission["status"]): Mission {
    const m = this.missions.get(id);
    if (!m) throw new Error(`missão não encontrada: ${id}`);
    const updated = { ...m, status, updatedAt: new Date().toISOString() };
    this.missions.set(id, updated);
    return updated;
  }

  createTask(input: {
    missionId: string;
    assigneeId: string;
    title: string;
    correlationId: string;
    dueAt?: string;
    dependsOn?: string[];
  }): Task {
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

  listTasks(missionId?: string): Task[] {
    const all = [...this.tasks.values()];
    return missionId ? all.filter((t) => t.missionId === missionId) : all;
  }

  setTaskStatus(id: string, status: Task["status"]): Task {
    const t = this.tasks.get(id);
    if (!t) throw new Error(`task não encontrada: ${id}`);
    const updated = { ...t, status };
    this.tasks.set(id, updated);
    return updated;
  }

  assign(missionId: string, agentId: string, role: string, assignedBy: string): StoredAgentAssignment {
    const a: StoredAgentAssignment = {
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

  listAssignments(missionId?: string): StoredAgentAssignment[] {
    const all = [...this.assignments.values()];
    return missionId ? all.filter((a) => a.missionId === missionId) : all;
  }

  // ---------- Runs / Steps ----------
  createRun(input: {
    missionId: string;
    agentId: string;
    correlationId: string;
    provider?: string;
  }): ExecutionRun {
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

  getRun(id: string): ExecutionRun | undefined {
    return this.runs.get(id);
  }

  listRuns(missionId?: string): ExecutionRun[] {
    const all = [...this.runs.values()];
    return missionId ? all.filter((r) => r.missionId === missionId) : all;
  }

  setRunStatus(id: string, status: ExecutionRun["status"], error?: string): ExecutionRun {
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

  addStep(input: {
    runId: string;
    tool: string;
    action: string;
    inputRef?: string;
    outputRef?: string;
    decision?: Record<string, unknown>;
  }): ExecutionStep {
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

  listSteps(runId?: string): ExecutionStep[] {
    return runId ? this.steps.filter((s) => s.runId === runId) : this.steps;
  }

  // ---------- Approvals ----------
  createApproval(input: {
    missionId: string;
    action: string;
    scope: string;
    reason: string;
    preview: Record<string, unknown>;
    requestedBy: string;
    approverRole: string;
    correlationId: string;
    expiresAt?: string;
  }): ApprovalRequest {
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

  getApproval(id: string): ApprovalRequest | undefined {
    return this.approvals.get(id);
  }

  listApprovals(status?: ApprovalRequest["status"]): ApprovalRequest[] {
    const all = [...this.approvals.values()];
    return status ? all.filter((a) => a.status === status) : all;
  }

  decideApproval(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason?: string,
  ): ApprovalRequest {
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

  // ---------- Drafts ----------
  createDraft(input: {
    missionId?: string;
    leadId?: string;
    channel: Channel;
    recipientPolicy: string;
    template?: string;
    claimRefs: string[];
    text: string;
    createdBy: string;
  }): CommercialDraft {
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

  getDraft(id: string): CommercialDraft | undefined {
    return this.drafts.get(id);
  }

  listDrafts(): CommercialDraft[] {
    return [...this.drafts.values()];
  }

  setDraftStatus(id: string, status: CommercialDraft["status"]): CommercialDraft {
    const d = this.drafts.get(id);
    if (!d) throw new Error(`draft não encontrado: ${id}`);
    const updated = { ...d, status, updatedAt: new Date().toISOString() };
    this.drafts.set(id, updated);
    return updated;
  }

  // ---------- Channel permissions ----------
  channelPermission(channel: Channel): ChannelPermissionRecord {
    const p = this.channelPermissions.get(channel);
    if (!p) throw new Error(`canal desconhecido: ${channel}`);
    return p;
  }

  // ---------- Audit (append-only, dentro do store para atomicidade com mutações) ----------
  appendAudit(event: AuditEvent): void {
    this.audit.push(event);
  }

  listAudit(filter?: { correlationId?: string; outcome?: AuditEvent["outcome"]; limit?: number }): AuditEvent[] {
    let out = this.audit;
    if (filter?.correlationId) out = out.filter((a) => a.correlationId === filter.correlationId);
    if (filter?.outcome) out = out.filter((a) => a.outcome === filter.outcome);
    return out.slice(-(filter?.limit ?? 500));
  }

  get workspaceSlug(): string {
    return this.workspace.slug;
  }
}

// tipos locais para evitar dependência circular
export type { AgentAssignmentLike };
