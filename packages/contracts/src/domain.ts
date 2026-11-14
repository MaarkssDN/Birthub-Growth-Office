import { z } from "zod";
import {
  LeadStatus,
  Channel,
  ClaimStatus,
  ApprovalStatus,
  DraftStatus,
  TaskStatus,
  OpportunityStage,
  OpportunityPriority,
  IcpProfileStatus,
  CommunicationDispatchStatus,
  OfferCategory,
  OfferItemStatus,
  AiProviderType,
  AiCostTier,
  AiProviderStatus,
  AiPrivacyTier,
} from "./enums";

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
  companyId: z.string().optional(),
  opportunityId: z.string().optional(),
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
  durationMs: z.number().int().nonnegative().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
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
  companyId: z.string().optional(),
  opportunityId: z.string().optional(),
  channel: Channel,
  recipientPolicy: z.string(),
  template: z.string().optional(),
  claimRefs: z.array(z.string()),
  subject: z.string().optional(),
  text: z.string(),
  version: z.number().int().default(1),
  status: DraftStatus,
  simulated: z.boolean(),
  scheduledFor: IsoDate.optional(),
  rejectionReason: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: IsoDate.optional(),
  createdBy: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type CommercialDraft = z.infer<typeof CommercialDraft>;

export const Opportunity = z.object({
  id: z.string(),
  workspaceId: z.string(),
  leadId: z.string().optional(),
  companyId: z.string().optional(),
  missionId: z.string().optional(),
  stage: OpportunityStage,
  priority: OpportunityPriority,
  icpScore: z.number().int().min(0).max(100),
  currentAgentId: z.string().optional(),
  nextAction: z.string().optional(),
  justification: z.string(),
  source: z.string(),
  approvedBy: z.string(),
  approvedAt: IsoDate,
  correlationId: z.string(),
  lostReason: z.string().optional(),
  lastActivityAt: IsoDate,
  ownerId: z.string().optional(),
  icpProfileId: z.string().optional(),
  icpVersion: z.number().int().default(1),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type Opportunity = z.infer<typeof Opportunity>;

export const OpportunityHistory = z.object({
  id: z.string(),
  opportunityId: z.string(),
  fromStage: z.string().optional(),
  toStage: z.string().optional(),
  action: z.string(),
  actor: z.string(),
  reason: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  correlationId: z.string(),
  occurredAt: IsoDate,
});
export type OpportunityHistory = z.infer<typeof OpportunityHistory>;

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

// ---------- Onda 12: ICP Dinâmico, Comunicação Supervisionada e Oferta Comercial ----------

export const IcpInclusionRule = z.object({
  id: z.string(),
  name: z.string(),
  weight: z.number().min(0).max(100),
  condition: z.string(), // ex: "cnae_in_target", "size_in_target", "active_status", "capital_min"
});
export type IcpInclusionRule = z.infer<typeof IcpInclusionRule>;

export const IcpExclusionRule = z.object({
  id: z.string(),
  name: z.string(),
  condition: z.string(), // ex: "status_inactive", "mei_porte", "prohibited_sector"
  reason: z.string(),
});
export type IcpExclusionRule = z.infer<typeof IcpExclusionRule>;

export const IcpWeights = z.object({
  cnae: z.number().min(0).max(100).default(30),
  size: z.number().min(0).max(100).default(25),
  location: z.number().min(0).max(100).default(20),
  operation: z.number().min(0).max(100).default(25),
});
export type IcpWeights = z.infer<typeof IcpWeights>;

export const CommercialIcpProfile = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string().min(2).max(150),
  version: z.number().int().min(1),
  status: IcpProfileStatus,
  description: z.string().optional(),
  targetSegments: z.array(z.string()),
  targetCnaes: z.array(z.string()),
  targetSizes: z.array(z.string()),
  targetUfs: z.array(z.string()),
  inclusions: z.array(IcpInclusionRule),
  exclusions: z.array(IcpExclusionRule),
  weights: IcpWeights,
  changeReason: z.string().optional(),
  approvedBy: z.string().optional(),
  approvedAt: IsoDate.optional(),
  createdBy: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type CommercialIcpProfile = z.infer<typeof CommercialIcpProfile>;

export const CommercialIcpHistory = z.object({
  id: z.string(),
  profileId: z.string(),
  action: z.string(),
  actor: z.string(),
  reason: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  occurredAt: IsoDate,
});
export type CommercialIcpHistory = z.infer<typeof CommercialIcpHistory>;

export const CommercialDraftHistory = z.object({
  id: z.string(),
  draftId: z.string(),
  version: z.number().int(),
  subject: z.string().optional(),
  text: z.string(),
  channel: Channel,
  claimRefs: z.array(z.string()),
  actor: z.string(),
  action: z.string(),
  reason: z.string().optional(),
  occurredAt: IsoDate,
});
export type CommercialDraftHistory = z.infer<typeof CommercialDraftHistory>;

export const CommunicationDispatch = z.object({
  id: z.string(),
  workspaceId: z.string(),
  draftId: z.string().optional(),
  opportunityId: z.string().optional(),
  channel: Channel,
  recipient: z.string(),
  subject: z.string().optional(),
  content: z.string(),
  status: CommunicationDispatchStatus,
  simulated: z.boolean().default(true),
  errorReason: z.string().optional(),
  dispatchedBy: z.string(),
  correlationId: z.string(),
  createdAt: IsoDate,
});
export type CommunicationDispatch = z.infer<typeof CommunicationDispatch>;

export const CommercialOfferItem = z.object({
  id: z.string(),
  workspaceId: z.string(),
  category: OfferCategory,
  title: z.string().min(2).max(200),
  content: z.string().min(5),
  evidenceUrl: z.string().optional(),
  status: OfferItemStatus,
  version: z.string().default("offer-v1"),
  approvedBy: z.string().optional(),
  approvedAt: IsoDate.optional(),
  createdBy: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
});
export type CommercialOfferItem = z.infer<typeof CommercialOfferItem>;

export const StructuredAgentOutput = z.object({
  facts: z.array(z.string()),
  inferences: z.array(z.string()),
  recommendations: z.array(z.string()),
});
export type StructuredAgentOutput = z.infer<typeof StructuredAgentOutput>;

// ---------- Onda 13: Prontidão Comercial, Ficha Consolidada e Métricas do Piloto ----------

export const CommercialReadinessItem = z.object({
  id: z.string(),
  category: OfferCategory,
  title: z.string(),
  status: OfferItemStatus,
  evidenceUrl: z.string().optional(),
  hasVerifiableEvidence: z.boolean(),
});
export type CommercialReadinessItem = z.infer<typeof CommercialReadinessItem>;

export const CommercialReadinessCategoryStatus = z.object({
  category: OfferCategory,
  label: z.string(),
  ready: z.boolean(),
  approvedCount: z.number().int().min(0),
  pendingCount: z.number().int().min(0),
  items: z.array(CommercialReadinessItem),
});
export type CommercialReadinessCategoryStatus = z.infer<typeof CommercialReadinessCategoryStatus>;

export const CommercialReadinessReport = z.object({
  workspaceId: z.string(),
  readyForOutreach: z.boolean(),
  readinessScore: z.number().min(0).max(100),
  categories: z.array(CommercialReadinessCategoryStatus),
  pendingClaims: z.array(z.string()),
  evaluatedAt: IsoDate,
  blockingReasons: z.array(z.string()),
});
export type CommercialReadinessReport = z.infer<typeof CommercialReadinessReport>;

export const ConsolidatedDossierSubject = z.object({
  id: z.string(),
  targetType: z.enum(["company", "voluntary_lead"]),
  name: z.string(),
  company: z.string(),
  cnpj: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string(),
  capturedAt: IsoDate,
  consentGiven: z.boolean(),
  privacyVersion: z.string().optional(),
  contactPreferences: z.array(Channel).optional(),
});
export type ConsolidatedDossierSubject = z.infer<typeof ConsolidatedDossierSubject>;

export const ConsolidatedCommercialDossier = z.object({
  id: z.string(),
  opportunityId: z.string(),
  companyId: z.string().optional(),
  leadId: z.string().optional(),
  subject: ConsolidatedDossierSubject,
  icp: z.object({
    profileId: z.string(),
    profileName: z.string(),
    version: z.number().int(),
    score: z.number().min(0).max(100),
    priority: OpportunityPriority,
    matchedInclusions: z.array(z.string()),
    gaps: z.array(z.string()),
  }),
  structuredQualification: StructuredAgentOutput,
  meridianDiagnosis: z.object({
    status: z.string(),
    provider: z.string(),
    model: z.string(),
    simulated: z.boolean(),
    latencyMs: z.number().optional(),
    costUnits: z.number().optional(),
  }),
  beaconOutreach: z.object({
    draftId: z.string().optional(),
    channel: Channel,
    subject: z.string().optional(),
    text: z.string().optional(),
    approvedClaims: z.array(z.string()),
    pendingClaims: z.array(z.string()),
    claimValidationOk: z.boolean(),
  }),
  pledgeCommitments: z.object({
    nextAction: z.string(),
    tasksCount: z.number().int(),
    pendingApprovalsCount: z.number().int(),
    followupsPlanned: z.array(z.string()),
  }),
  governance: z.object({
    canApprove: z.boolean(),
    approvalId: z.string().optional(),
    approvalStatus: ApprovalStatus.optional(),
    blockers: z.array(z.string()),
    externalSendBlocked: z.literal(true),
    simulated: z.boolean(),
  }),
  costsAndDuration: z.object({
    totalCostUnits: z.number().min(0),
    totalDurationMs: z.number().min(0),
    runsCount: z.number().int().min(0),
  }),
  timeline: z.array(
    z.object({
      at: IsoDate,
      actor: z.string(),
      action: z.string(),
      note: z.string().optional(),
    }),
  ),
});
export type ConsolidatedCommercialDossier = z.infer<typeof ConsolidatedCommercialDossier>;

export const PilotMetricsReport = z.object({
  leadsReceived: z.number().int().min(0),
  leadsQualified: z.number().int().min(0),
  targetCompaniesIdentified: z.number().int().min(0),
  opportunitiesOpened: z.number().int().min(0),
  outreachPrepared: z.number().int().min(0),
  outreachApproved: z.number().int().min(0),
  meetingsProposed: z.number().int().min(0),
  meetingsHeld: z.object({
    count: z.number().int().min(0),
    status: z.enum(["absent", "simulated", "real"]),
  }),
  stageConversion: z.record(z.number()),
  avgExecutionDurationMs: z.number().min(0),
  aiConsumption: z.object({
    totalTokens: z.number().int().min(0),
    totalCostUnits: z.number().min(0),
    mode: z.string(),
  }),
  pendingApprovalsCount: z.number().int().min(0),
  dataHonesty: z.object({
    simulated: z.boolean(),
    externalDispatchesReal: z.literal(false),
    notes: z.string(),
  }),
});
export type PilotMetricsReport = z.infer<typeof PilotMetricsReport>;

// ---------- Onda 14: IA Real Multiprovedor — Prioridade Gratuita ----------

export const AiHardwareInfo = z.object({
  cpu: z.string(),
  cores: z.number().int().optional(),
  ramGb: z.number(),
  gpu: z.string(),
  vramMb: z.number().optional(),
  os: z.string().optional(),
});
export type AiHardwareInfo = z.infer<typeof AiHardwareInfo>;

export const AiProviderInfo = z.object({
  id: z.string(),
  name: z.string(),
  type: AiProviderType,
  status: AiProviderStatus,
  isLocal: z.boolean(),
  costTier: AiCostTier,
  model: z.string(),
  availableModels: z.array(z.string()),
  priority: z.number().int(),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
  rateLimit: z
    .object({
      rpm: z.number().optional(),
      rpd: z.number().optional(),
      resetAt: IsoDate.optional(),
    })
    .optional(),
  privacyTier: AiPrivacyTier,
  hardwareInfo: AiHardwareInfo.optional(),
});
export type AiProviderInfo = z.infer<typeof AiProviderInfo>;

export const AiProviderRegistry = z.object({
  activeProviderId: z.string(),
  providers: z.array(AiProviderInfo),
  hardware: AiHardwareInfo,
  routerPolicy: z.object({
    maxExternalCostBrl: z.literal(0),
    preferLocal: z.literal(true),
    enforcePrivacySanitization: z.literal(true),
    allowPaidTier: z.literal(false),
  }),
  updatedAt: IsoDate,
});
export type AiProviderRegistry = z.infer<typeof AiProviderRegistry>;

export const AiInferenceLog = z.object({
  id: z.string(),
  timestamp: IsoDate,
  agentId: z.string(),
  promptKey: z.string(),
  promptVersion: z.string(),
  provider: z.string(),
  providerType: AiProviderType,
  model: z.string(),
  simulated: z.boolean(),
  isLocal: z.boolean(),
  status: z.enum(["success", "failure", "blocked", "fallback"]),
  latencyMs: z.number(),
  tokensIn: z.number().int(),
  tokensOut: z.number().int(),
  costUnits: z.number().int(),
  costBrl: z.number(),
  error: z.string().optional(),
  missionId: z.string().optional(),
  correlationId: z.string().optional(),
});
export type AiInferenceLog = z.infer<typeof AiInferenceLog>;

export const MultiProviderDiagnosisInput = z.object({
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  missionId: z.string().optional(),
  correlationId: z.string().optional(),
  preferredProvider: z.string().optional(),
  preferredModel: z.string().optional(),
  forceReal: z.boolean().optional(),
  synthetic: z.boolean().default(true),
  name: z.string().optional(),
  company: z.string().optional(),
  interest: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  score: z.number().optional(),
  rubricVersion: z.string().optional(),
  gaps: z.array(z.string()).optional(),
  approvedClaims: z.array(z.string()).optional(),
  icp: z.unknown().optional(),
});
export type MultiProviderDiagnosisInput = z.infer<typeof MultiProviderDiagnosisInput>;
