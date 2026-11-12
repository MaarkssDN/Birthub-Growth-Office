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

export type {
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
};
export type AgentAssignmentLike = {
  id: string;
  missionId: string;
  agentId: string;
  role: string;
  assignedBy: string;
  assignedAt: string;
};
