import { z } from "zod";
import { LeadStatus, Channel, ClaimStatus, ApprovalStatus, DraftStatus, TaskStatus } from "./enums";

export const Uuid = z.string().min(8);
export const IsoDate = z.string();

export const Provenance = z.object({
  source: z.string(),
  at: IsoDate,
  legalBasis: z.string(),
});
export type Provenance = z.infer<typeof Provenance>;

export const Consent = z.object({
  channel: Channel,
  optIn: z.boolean(),
  at: IsoDate,
});
export type Consent = z.infer<typeof Consent>;

export const PrivacyConsent = z.object({
  noticeVersion: z.string(),
  acceptedAt: IsoDate,
  channels: z.array(Channel),
  marketingOptIn: z.boolean(),
});
export type PrivacyConsent = z.infer<typeof PrivacyConsent>;

export const Lead = z.object({
  id: Uuid,
  workspaceId: z.string(),
  source: z.string(),
  sourceUrl: z.string().optional(),
  capturedAt: IsoDate,
  status: LeadStatus,
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  interest: z.string().optional(),
  synthetic: z.boolean(),
  provenance: Provenance,
  consent: Consent.optional(),
  privacy: PrivacyConsent.optional(),
  dedupKey: z.string().optional(),
  suppressedAt: IsoDate.optional(),
  createdBy: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Lead = z.infer<typeof Lead>;

export const PRIVACY_NOTICE_VERSION = "lgpd-notice-v1";

export const CaptureFormInput = z.object({
  name: z.string().min(2).max(120),
  company: z.string().min(2).max(160),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional(),
  interest: z.string().min(3).max(500),
  source: z.enum(["demo_form", "indication", "content", "synthetic", "website_form"]),
  sourceUrl: z.string().url().optional(),
  privacy: z.object({
    noticeVersion: z.literal(PRIVACY_NOTICE_VERSION),
    marketingOptIn: z.boolean(),
    channels: z.array(Channel).min(1),
  }),
  /** honeypot anti-spam — deve vir vazio */
  website: z.string().max(0).optional(),
});
export type CaptureFormInput = z.infer<typeof CaptureFormInput>;

export const CaptureResult = z.object({
  leadId: Uuid,
  duplicate: z.boolean(),
  status: LeadStatus,
  message: z.string(),
});
export type CaptureResult = z.infer<typeof CaptureResult>;

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const SessionInfo = z.object({
  userId: Uuid,
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["owner", "operator", "approver", "auditor"]),
  expiresAt: IsoDate,
});
export type SessionInfo = z.infer<typeof SessionInfo>;

export const CreateLeadInput = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  source: z.enum(["demo_form", "indication", "content", "synthetic", "website_form"]),
  sourceUrl: z.string().url().optional(),
  synthetic: z.boolean().default(true),
  consent: Consent.optional(),
});
export type CreateLeadInput = z.infer<typeof CreateLeadInput>;

export const OfferClaim = z.object({
  id: Uuid,
  claim: z.string(),
  evidenceUrl: z.string().optional(),
  status: ClaimStatus,
  version: z.string(),
  approvedBy: z.string().optional(),
});
export type OfferClaim = z.infer<typeof OfferClaim>;

export const ICPProfile = z.object({
  id: Uuid,
  revision: z.string(),
  hypothesis: z.literal(true),
  segments: z.array(z.string()),
  pains: z.array(z.string()),
  excludes: z.array(z.string()),
  scoreRubric: z.record(z.number()),
  validatedAt: IsoDate.optional(),
});
export type ICPProfile = z.infer<typeof ICPProfile>;

export const RubricResult = z.object({
  leadId: Uuid,
  score: z.number().min(0).max(100),
  rubricVersion: z.string(),
  components: z.array(
    z.object({
      key: z.string(),
      weight: z.number(),
      points: z.number(),
      evidence: z.string(),
    }),
  ),
  gaps: z.array(z.string()),
  recommendation: z.enum(["qualified", "nurture", "needs_info"]),
});
export type RubricResult = z.infer<typeof RubricResult>;

export const Task = z.object({
  id: Uuid,
  missionId: Uuid,
  assigneeId: z.string(),
  title: z.string(),
  status: TaskStatus,
  dueAt: IsoDate.optional(),
  dependsOn: z.array(Uuid).default([]),
  correlationId: z.string(),
});
export type Task = z.infer<typeof Task>;

export const Mission = z.object({
  id: Uuid,
  workspaceId: z.string(),
  leadId: Uuid.optional(),
  requester: z.string(),
  goal: z.string(),
  status: z.enum([
    "draft", "queued", "running", "waiting_input",
    "awaiting_approval", "completed", "failed", "cancelled",
  ]),
  correlationId: z.string(),
  createdBy: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Mission = z.infer<typeof Mission>;

export const ExecutionStep = z.object({
  id: Uuid,
  runId: Uuid,
  seq: z.number().int().positive(),
  tool: z.string(),
  action: z.string(),
  inputRef: z.string().optional(),
  outputRef: z.string().optional(),
  decision: z.record(z.unknown()).optional(),
  createdAt: IsoDate,
});
export type ExecutionStep = z.infer<typeof ExecutionStep>;

export const ExecutionRun = z.object({
  id: Uuid,
  missionId: Uuid,
  agentId: z.string(),
  provider: z.string(),
  mock: z.boolean(),
  status: z.enum([
    "draft", "queued", "running", "waiting_input",
    "awaiting_approval", "completed", "failed", "cancelled",
  ]),
  costUnits: z.number().int().nonnegative(),
  correlationId: z.string(),
  error: z.string().optional(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type ExecutionRun = z.infer<typeof ExecutionRun>;

export const ApprovalRequest = z.object({
  id: Uuid,
  missionId: Uuid,
  action: z.string(),
  scope: z.string(),
  reason: z.string(),
  preview: z.record(z.unknown()),
  requestedBy: z.string(),
  approverRole: z.string(),
  status: ApprovalStatus,
  decision: z.string().optional(),
  decidedBy: z.string().optional(),
  decidedAt: IsoDate.optional(),
  decidedReason: z.string().optional(),
  expiresAt: IsoDate.optional(),
  correlationId: z.string(),
  createdAt: IsoDate,
});
export type ApprovalRequest = z.infer<typeof ApprovalRequest>;

export const ApprovalDecisionInput = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(2000).optional(),
});
export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionInput>;

export const CommercialDraft = z.object({
  id: Uuid,
  missionId: Uuid.optional(),
  leadId: Uuid.optional(),
  channel: Channel,
  recipientPolicy: z.string(),
  template: z.string().optional(),
  claimRefs: z.array(z.string()),
  text: z.string(),
  status: DraftStatus,
  simulated: z.boolean(),
  createdBy: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type CommercialDraft = z.infer<typeof CommercialDraft>;

export const AuditEvent = z.object({
  id: Uuid,
  actor: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  occurredAt: IsoDate,
  correlationId: z.string(),
  redactedPayload: z.record(z.unknown()).optional(),
  outcome: z.enum(["allowed", "denied", "info"]),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

export const AgentVisualFlags = z.object({
  awaitingApproval: z.boolean(),
  simulated: z.boolean(),
});
export type AgentVisualFlags = z.infer<typeof AgentVisualFlags>;
