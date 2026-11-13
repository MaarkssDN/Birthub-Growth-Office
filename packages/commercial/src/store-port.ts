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

export interface AgentAssignmentRecord {
  id: string;
  missionId: string;
  agentId: string;
  role: string;
  assignedBy: string;
  assignedAt: string;
}

export interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  workspaceId: string;
  role: UserAccount["role"];
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastSeenAt: string;
}

export interface NewSession {
  userId: string;
  workspaceId: string;
  role: UserAccount["role"];
  tokenHash: string;
  expiresAt: string;
}

/**
 * Porta de persistência da Onda 01 — toda mutação é assíncrona.
 * Implementações: Store (memória, dev/testes) e PrismaStore (packages/db, real).
 */
export interface StorePort {
  readonly workspace: Workspace;
  readonly workspaceSlug: string;

  // users & sessions
  findUserByEmail(email: string): Promise<UserAccount | undefined>;
  getUser(id: string): Promise<UserAccount | undefined>;
  upsertUser(user: UserAccount): Promise<UserAccount>;
  createSession(input: NewSession): Promise<SessionRecord>;
  getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | undefined>;
  revokeSession(tokenHash: string): Promise<void>;
  touchSession(tokenHash: string): Promise<void>;

  // leads
  createLead(input: CreateLeadInput & Partial<Lead>, actor: string): Promise<Lead>;
  getLead(id: string): Promise<Lead | undefined>;
  listLeads(): Promise<Lead[]>;
  findLeadByDedupKey(dedupKey: string): Promise<Lead | undefined>;
  transitionLead(id: string, to: LeadStatus, actor: string): Promise<Lead>;
  updateLead(id: string, patch: Partial<Lead>): Promise<Lead>;

  // missions & tasks
  createMission(input: {
    goal: string;
    requester: string;
    leadId?: string;
    companyId?: string;
    opportunityId?: string;
    correlationId: string;
    createdBy: string;
  }): Promise<Mission>;
  getMission(id: string): Promise<Mission | undefined>;
  listMissions(): Promise<Mission[]>;
  setMissionStatus(id: string, status: Mission["status"]): Promise<Mission>;
  createTask(input: {
    missionId: string;
    assigneeId: string;
    title: string;
    correlationId: string;
    dueAt?: string;
    dependsOn?: string[];
  }): Promise<Task>;
  listTasks(missionId?: string): Promise<Task[]>;
  setTaskStatus(id: string, status: Task["status"]): Promise<Task>;
  assign(missionId: string, agentId: string, role: string, assignedBy: string): Promise<AgentAssignmentRecord>;
  listAssignments(missionId?: string): Promise<AgentAssignmentRecord[]>;

  // runs & steps
  createRun(input: {
    missionId: string;
    agentId: string;
    correlationId: string;
    provider?: string;
    mock?: boolean;
    input?: Record<string, unknown>;
  }): Promise<ExecutionRun>;
  getRun(id: string): Promise<ExecutionRun | undefined>;
  listRuns(missionId?: string): Promise<ExecutionRun[]>;
  setRunStatus(
    id: string,
    status: ExecutionRun["status"],
    error?: string,
    meta?: { durationMs?: number; costUnits?: number; output?: Record<string, unknown> },
  ): Promise<ExecutionRun>;
  addStep(input: {
    runId: string;
    tool: string;
    action: string;
    inputRef?: string;
    outputRef?: string;
    decision?: Record<string, unknown>;
  }): Promise<ExecutionStep>;
  listSteps(runId?: string): Promise<ExecutionStep[]>;

  // approvals
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
  }): Promise<ApprovalRequest>;
  getApproval(id: string): Promise<ApprovalRequest | undefined>;
  listApprovals(status?: ApprovalRequest["status"]): Promise<ApprovalRequest[]>;
  decideApproval(
    id: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason?: string,
  ): Promise<ApprovalRequest>;

  // drafts
  createDraft(input: {
    missionId?: string;
    leadId?: string;
    companyId?: string;
    opportunityId?: string;
    channel: Channel;
    recipientPolicy: string;
    template?: string;
    claimRefs: string[];
    text: string;
    createdBy: string;
  }): Promise<CommercialDraft>;
  getDraft(id: string): Promise<CommercialDraft | undefined>;
  listDrafts(): Promise<CommercialDraft[]>;
  setDraftStatus(id: string, status: CommercialDraft["status"]): Promise<CommercialDraft>;

  // permissions & audit
  channelPermission(channel: Channel): ChannelPermissionRecord;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(filter?: { correlationId?: string; outcome?: AuditEvent["outcome"]; limit?: number }): Promise<AuditEvent[]>;
}
