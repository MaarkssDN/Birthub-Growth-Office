import { z } from "zod";

export const WORKSPACE_SLUG = "birthub-growth";

export const LeadStatus = z.enum([
  "new",
  "triage",
  "qualified",
  "nurture",
  "meeting_requested",
  "proposal",
  "won",
  "lost",
  "suppressed",
]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const MissionStatus = z.enum([
  "draft",
  "queued",
  "running",
  "waiting_input",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);
export type MissionStatus = z.infer<typeof MissionStatus>;

export const RunStatus = z.enum([
  "draft",
  "queued",
  "running",
  "waiting_input",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const AgentVisualState = z.enum([
  "idle",
  "listening",
  "processing",
  "speaking",
  "success",
  "error",
]);
export type AgentVisualState = z.infer<typeof AgentVisualState>;

export const AutonomyLevel = z.enum(["L0", "L1", "L2", "L3", "L4"]);
export type AutonomyLevel = z.infer<typeof AutonomyLevel>;

export const AgentLayer = z.enum(["pillar", "commercial", "channel", "supervision"]);
export type AgentLayer = z.infer<typeof AgentLayer>;

export const ImplementationStatus = z.enum([
  "IMPLEMENTADO",
  "SIMULADO",
  "PLANEJADO",
  "BLOQUEADO",
  "PENDENTE_DE_VALIDACAO",
]);
export type ImplementationStatus = z.infer<typeof ImplementationStatus>;

export const ApprovalStatus = z.enum(["pending", "approved", "rejected", "expired"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatus>;

export const DraftStatus = z.enum(["draft", "approved", "rejected", "sent_blocked"]);
export type DraftStatus = z.infer<typeof DraftStatus>;

export const Channel = z.enum(["email", "whatsapp", "phone", "internal_note"]);
export type Channel = z.infer<typeof Channel>;

export const ClaimStatus = z.enum(["approved", "pending", "rejected"]);
export type ClaimStatus = z.infer<typeof ClaimStatus>;

export const TaskStatus = z.enum(["pending", "assigned", "done", "blocked", "cancelled"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const OpportunityStage = z.enum([
  "approved_target",
  "researching",
  "qualifying",
  "qualified",
  "outreach_drafted",
  "awaiting_approval",
  "followup_planned",
  "nurture",
  "won",
  "lost",
  "archived",
]);
export type OpportunityStage = z.infer<typeof OpportunityStage>;

export const OpportunityPriority = z.enum(["low", "normal", "high", "critical"]);
export type OpportunityPriority = z.infer<typeof OpportunityPriority>;

/** Estados visuais do contrato de eventos do escritório (Onda 02/Fase 06). */
export const VISUAL_STATES = ["idle","listening","processing","speaking","success","error"] as const;
export type VisualState = (typeof VISUAL_STATES)[number];
