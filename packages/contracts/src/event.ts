import { z } from "zod";

export const EVENT_VERSION = 1 as const;

export const EventType = z.enum([
  "lead.created.v1",
  "lead.qualified.v1",
  "lead.status_changed.v1",
  "mission.created.v1",
  "mission.assigned.v1",
  "mission.status_changed.v1",
  "run.started.v1",
  "run.step.completed.v1",
  "run.completed.v1",
  "run.failed.v1",
  "draft.created.v1",
  "draft.decided.v1",
  "approval.requested.v1",
  "approval.decided.v1",
  "audit.denied.v1",
  "audit.recorded.v1",
  "scout.import.completed.v1",
  "scout.company.reviewed.v1",
  "opportunity.created.v1",
  "opportunity.stage_changed.v1",
  "opportunity.priority_changed.v1",
  "opportunity.mission_started.v1",
  // Onda 12: ICP Dinâmico, Comunicação e Oferta
  "icp.created.v1",
  "icp.approval_requested.v1",
  "icp.approved.v1",
  "icp.archived.v1",
  "communication.draft_created.v1",
  "communication.draft_updated.v1",
  "communication.draft_approved.v1",
  "communication.dispatched_simulated.v1",
  "offer_catalog.item_added.v1",
  "offer_catalog.item_approved.v1",
  // Onda 13: Primeiro Piloto Comercial Supervisionado
  "pilot.lead_onboarded.v1",
  "pilot.dossier_reviewed.v1",
  "commercial_readiness.evaluated.v1",
]);
export type EventType = z.infer<typeof EventType>;

export const EventEnvelope = z.object({
  eventId: z.string().uuid(),
  eventType: EventType,
  version: z.literal(EVENT_VERSION),
  workspaceId: z.string().min(1),
  missionId: z.string().optional(),
  agentId: z.string().optional(),
  occurredAt: z.string().datetime(),
  correlationId: z.string().min(1),
  payload: z.record(z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;

/** Payloads mínimos por evento — validação estrutural, sem PII. */
export const EventPayloads = {
  "lead.created.v1": z.object({
    leadId: z.string(),
    source: z.string(),
    synthetic: z.boolean(),
    status: z.string(),
  }),
  "lead.qualified.v1": z.object({
    leadId: z.string(),
    score: z.number(),
    rubricVersion: z.string(),
    gaps: z.array(z.string()),
  }),
  "lead.status_changed.v1": z.object({
    leadId: z.string(),
    from: z.string(),
    to: z.string(),
  }),
  "mission.created.v1": z.object({
    missionId: z.string(),
    goal: z.string(),
    leadId: z.string().optional(),
  }),
  "mission.assigned.v1": z.object({
    missionId: z.string(),
    taskId: z.string().optional(),
    assigneeId: z.string(),
  }),
  "mission.status_changed.v1": z.object({
    missionId: z.string(),
    from: z.string(),
    to: z.string(),
  }),
  "run.started.v1": z.object({
    runId: z.string(),
    missionId: z.string(),
    agentId: z.string(),
    mock: z.boolean(),
  }),
  "run.step.completed.v1": z.object({
    runId: z.string(),
    stepSeq: z.number().int().positive(),
    tool: z.string(),
    action: z.string(),
    simulated: z.boolean(),
  }),
  "run.completed.v1": z.object({
    runId: z.string(),
    status: z.string(),
    simulated: z.boolean(),
  }),
  "run.failed.v1": z.object({
    runId: z.string(),
    error: z.string(),
    simulated: z.boolean(),
  }),
  "draft.created.v1": z.object({
    draftId: z.string(),
    channel: z.string(),
    claimRefs: z.array(z.string()),
    simulated: z.boolean(),
  }),
  "draft.decided.v1": z.object({
    draftId: z.string(),
    decision: z.string(),
    decidedBy: z.string(),
  }),
  "approval.requested.v1": z.object({
    approvalId: z.string(),
    action: z.string(),
    requestedBy: z.string(),
    scope: z.string(),
  }),
  "approval.decided.v1": z.object({
    approvalId: z.string(),
    decision: z.string(),
    decidedBy: z.string(),
    reason: z.string().optional(),
  }),
  "audit.denied.v1": z.object({
    actor: z.string(),
    action: z.string(),
    reason: z.string(),
  }),
  "audit.recorded.v1": z.object({
    actor: z.string(),
    action: z.string(),
    entity: z.string(),
    outcome: z.string(),
  }),
  "scout.import.completed.v1": z.object({
    batchId: z.string().optional(),
    imported: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  }),
  "scout.company.reviewed.v1": z.object({
    companyId: z.string(),
    cnpj: z.string(),
    decision: z.string(),
    score: z.number(),
  }),
  "opportunity.created.v1": z.object({
    opportunityId: z.string(),
    companyId: z.string(),
    cnpj: z.string().optional(),
    stage: z.string(),
    icpScore: z.number(),
    priority: z.string().optional(),
    approvedBy: z.string(),
  }),
  "opportunity.stage_changed.v1": z.object({
    opportunityId: z.string(),
    companyId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    fromStage: z.string().optional(),
    toStage: z.string().optional(),
    actor: z.string(),
    reason: z.string().optional(),
  }),
  "opportunity.priority_changed.v1": z.object({
    opportunityId: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
    fromPriority: z.string().optional(),
    toPriority: z.string().optional(),
    actor: z.string(),
  }),
  "opportunity.mission_started.v1": z.object({
    opportunityId: z.string(),
    companyId: z.string(),
    missionId: z.string(),
    requester: z.string(),
  }),
  // Onda 12: ICP Dinâmico, Comunicação Supervisionada e Oferta Comercial
  "icp.created.v1": z.object({
    profileId: z.string(),
    name: z.string(),
    version: z.number().int(),
    createdBy: z.string(),
  }),
  "icp.approval_requested.v1": z.object({
    profileId: z.string(),
    version: z.number().int(),
    requestedBy: z.string(),
  }),
  "icp.approved.v1": z.object({
    profileId: z.string(),
    version: z.number().int(),
    approvedBy: z.string(),
  }),
  "icp.archived.v1": z.object({
    profileId: z.string(),
    version: z.number().int(),
    actor: z.string(),
  }),
  "communication.draft_created.v1": z.object({
    draftId: z.string(),
    opportunityId: z.string().optional(),
    channel: z.string(),
    version: z.number().int(),
    createdBy: z.string(),
  }),
  "communication.draft_updated.v1": z.object({
    draftId: z.string(),
    version: z.number().int(),
    actor: z.string(),
  }),
  "communication.draft_approved.v1": z.object({
    draftId: z.string(),
    version: z.number().int(),
    approvedBy: z.string(),
  }),
  "communication.dispatched_simulated.v1": z.object({
    dispatchId: z.string(),
    channel: z.string(),
    recipient: z.string(),
    status: z.string(),
    simulated: z.literal(true),
    dispatchedBy: z.string(),
  }),
  "offer_catalog.item_added.v1": z.object({
    itemId: z.string(),
    category: z.string(),
    title: z.string(),
    createdBy: z.string(),
  }),
  "offer_catalog.item_approved.v1": z.object({
    itemId: z.string(),
    category: z.string(),
    approvedBy: z.string(),
  }),
  "pilot.lead_onboarded.v1": z.object({
    leadId: z.string(),
    opportunityId: z.string(),
    actor: z.string(),
  }),
  "pilot.dossier_reviewed.v1": z.object({
    opportunityId: z.string(),
    decision: z.string(),
    reviewedBy: z.string(),
  }),
  "commercial_readiness.evaluated.v1": z.object({
    readyForOutreach: z.boolean(),
    readinessScore: z.number(),
    evaluatedBy: z.string(),
  }),
} as const;

export function validateEventPayload(
  eventType: EventType,
  payload: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  const schema = EventPayloads[eventType as keyof typeof EventPayloads];
  if (!schema) return { ok: false, error: `sem schema para ${eventType}` };
  const r = schema.safeParse(payload);
  return r.success ? { ok: true } : { ok: false, error: r.error.message };
}
