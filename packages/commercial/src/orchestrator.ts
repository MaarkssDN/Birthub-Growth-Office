import { randomUUID } from "node:crypto";
import type { ApprovalRequest, CreateLeadInput, EventType, Lead, Mission, RubricResult } from "@bgo/contracts";
import { evaluatePolicy } from "@bgo/agents";
import { eventBus, recordAudit } from "@bgo/observability";
import type { StorePort } from "./store-port";
import type { CommercialDraft } from "./types";
import { scoreLead } from "./rubric";
import { claimsForDraft, approvedClaimIds } from "./offer";

export interface DemoFlowResult {
  correlationId: string;
  lead: Lead;
  mission: Mission;
  rubric: RubricResult;
  draft: CommercialDraft;
  approvalId: string;
  simulated: true;
}

const now = () => new Date().toISOString();

function emit(
  store: StorePort,
  eventType: EventType,
  correlationId: string,
  payload: Record<string, unknown>,
  extra?: { missionId?: string; agentId?: string },
) {
  return eventBus.publish({
    eventType,
    workspaceId: store.workspace.slug,
    correlationId,
    payload,
    ...(extra?.missionId !== undefined ? { missionId: extra.missionId } : {}),
    ...(extra?.agentId !== undefined ? { agentId: extra.agentId } : {}),
  });
}

async function audit(
  store: StorePort,
  actor: string,
  action: string,
  entity: string,
  entityId: string,
  correlationId: string,
  outcome: "allowed" | "denied" | "info",
  payload?: Record<string, unknown>,
) {
  const ev = recordAudit({
    actor,
    action,
    entity,
    entityId,
    workspaceId: store.workspace.slug,
    correlationId,
    outcome,
    ...(payload !== undefined ? { payload } : {}),
    publishEvent: false,
  });
  await store.appendAudit(ev);
  return ev;
}

/** Executa um run mock de um agente: steps auditados com policy check. */
async function runAgent(
  store: StorePort,
  input: {
    missionId: string;
    agentId: string;
    correlationId: string;
    steps: { tool: string; action: string; inputRef?: string; outputRef?: string; decision?: Record<string, unknown> }[];
  },
) {
  const run = await store.createRun({
    missionId: input.missionId,
    agentId: input.agentId,
    correlationId: input.correlationId,
    provider: "mock",
  });
  emit(store, "run.started.v1", input.correlationId, {
    runId: run.id,
    missionId: input.missionId,
    agentId: input.agentId,
    mock: true,
  }, { missionId: input.missionId, agentId: input.agentId });
  await audit(store, `agent:${input.agentId}`, "run.start", "ExecutionRun", run.id, input.correlationId, "allowed", { mock: true });

  await store.setRunStatus(run.id, "running");
  for (const s of input.steps) {
    const decision = evaluatePolicy({
      agentId: input.agentId,
      tool: s.tool,
      action: s.action,
      context: {
        hasApproval: false,
        channelAllowed: false,
        optInVerified: false,
        claimApproved: true,
        selfApproval: false,
        crossTenant: false,
      },
    });
    await store.addStep({
      runId: run.id,
      tool: s.tool,
      action: s.action,
      ...(s.inputRef !== undefined ? { inputRef: s.inputRef } : {}),
      ...(s.outputRef !== undefined ? { outputRef: s.outputRef } : {}),
      decision: { policy: decision.allowed ? "allowed" : "denied", reason: decision.reason, level: decision.level, simulated: true },
    });
    if (!decision.allowed) {
      await audit(store, `agent:${input.agentId}`, `${s.tool}.${s.action}`, "ExecutionStep", run.id, input.correlationId, "denied", { reason: decision.reason });
      emit(store, "audit.denied.v1", input.correlationId, {
        actor: `agent:${input.agentId}`,
        action: `${s.tool}.${s.action}`,
        reason: decision.reason,
      }, { missionId: input.missionId, agentId: input.agentId });
      await store.setRunStatus(run.id, "failed", decision.reason);
      emit(store, "run.failed.v1", input.correlationId, {
        runId: run.id,
        error: decision.reason,
        simulated: true,
      }, { missionId: input.missionId, agentId: input.agentId });
      return (await store.getRun(run.id))!;
    }
    emit(store, "run.step.completed.v1", input.correlationId, {
      runId: run.id,
      stepSeq: (await store.listSteps(run.id)).length,
      tool: s.tool,
      action: s.action,
      simulated: true,
    }, { missionId: input.missionId, agentId: input.agentId });
  }
  await store.setRunStatus(run.id, "completed");
  emit(store, "run.completed.v1", input.correlationId, {
    runId: run.id,
    status: "completed",
    simulated: true,
  }, { missionId: input.missionId, agentId: input.agentId });
  await audit(store, `agent:${input.agentId}`, "run.complete", "ExecutionRun", run.id, input.correlationId, "allowed", { simulated: true });
  return (await store.getRun(run.id))!;
}

/**
 * Fluxo demonstrativo (tudo SIMULADO) sobre StorePort persistido:
 * lead sintético → missão Aegis → dispatch Relay → dossiê Scout →
 * qualificação Meridian → rascunho Beacon → lembrete Pledge → aprovação pendente.
 */
export async function runDemoFlow(store: StorePort, input?: Partial<CreateLeadInput>): Promise<DemoFlowResult> {
  const correlationId = randomUUID();
  const leadInput = {
    name: "Lead Demo Sintético",
    email: "demo@synthetic.bgo.local",
    source: "demo_form" as const,
    synthetic: true,
    ...(input ?? {}),
    consent: input?.consent ?? { channel: "email" as const, optIn: true, at: now() },
  };

  const lead = await store.createLead(leadInput, "user:demo");
  emit(store, "lead.created.v1", correlationId, {
    leadId: lead.id,
    source: lead.source,
    synthetic: lead.synthetic,
    status: lead.status,
  });
  await audit(store, "user:demo", "lead.create", "Lead", lead.id, correlationId, "allowed", { synthetic: true });

  const mission = await store.createMission({
    goal: "Primeira abordagem comercial revisável para lead sintético (M-003)",
    requester: "user:demo",
    leadId: lead.id,
    correlationId,
    createdBy: "agent:aegis",
  });
  emit(store, "mission.created.v1", correlationId, {
    missionId: mission.id,
    goal: mission.goal,
    leadId: lead.id,
  }, { missionId: mission.id, agentId: "aegis" });
  await store.setMissionStatus(mission.id, "queued");
  await store.setMissionStatus(mission.id, "running");
  await audit(store, "agent:aegis", "mission.create", "Mission", mission.id, correlationId, "allowed");

  const assignments = [
    { agentId: "relay", role: "coordenador" },
    { agentId: "scout", role: "pesquisa" },
    { agentId: "meridian", role: "qualificação" },
    { agentId: "beacon", role: "abordagem" },
    { agentId: "pledge", role: "acompanhamento" },
  ] as const;
  for (const a of assignments) {
    await store.assign(mission.id, a.agentId, a.role, "agent:aegis");
    emit(store, "mission.assigned.v1", correlationId, {
      missionId: mission.id,
      assigneeId: a.agentId,
    }, { missionId: mission.id, agentId: a.agentId });
  }
  const relayTask = await store.createTask({
    missionId: mission.id,
    assigneeId: "relay",
    title: "Distribuir etapas da missão e definir SLA interno",
    correlationId,
  });
  await audit(store, "agent:relay", "task.dispatch", "Task", relayTask.id, correlationId, "allowed");
  await store.setTaskStatus(relayTask.id, "done");

  await runAgent(store, {
    missionId: mission.id,
    agentId: "scout",
    correlationId,
    steps: [
      { tool: "research.web", action: "search_account", inputRef: `lead:${lead.id}`, outputRef: "dossier:synthetic-account" },
      { tool: "research.web", action: "record_sources", outputRef: "sources:synthetic-3-urls" },
    ],
  });

  const freshLead = (await store.getLead(lead.id))!;
  const rubric = scoreLead(freshLead);
  await runAgent(store, {
    missionId: mission.id,
    agentId: "meridian",
    correlationId,
    steps: [
      { tool: "lead.score", action: "apply_rubric", inputRef: `lead:${lead.id}`, outputRef: `rubric:${rubric.rubricVersion}`, decision: { score: rubric.score, recommendation: rubric.recommendation } },
      { tool: "lead.score", action: "record_gaps", outputRef: `gaps:${rubric.gaps.length}` },
    ],
  });
  if (rubric.recommendation === "qualified") {
    await store.transitionLead(lead.id, "triage", "agent:meridian");
    emit(store, "lead.status_changed.v1", correlationId, { leadId: lead.id, from: "new", to: "triage" });
    await store.transitionLead(lead.id, "qualified", "agent:meridian");
    emit(store, "lead.status_changed.v1", correlationId, { leadId: lead.id, from: "triage", to: "qualified" });
  }
  emit(store, "lead.qualified.v1", correlationId, {
    leadId: lead.id,
    score: rubric.score,
    rubricVersion: rubric.rubricVersion,
    gaps: rubric.gaps,
  }, { missionId: mission.id, agentId: "meridian" });
  await audit(store, "agent:meridian", "lead.qualify", "Lead", lead.id, correlationId, "allowed", { score: rubric.score, simulated: true });

  const approved = claimsForDraft();
  const draftText =
    "Olá! Sou da equipe do Birthub Growth Office. Registramos seu interesse e gostaríamos de " +
    "conversar sobre como o Birthub 360° pode apoiar sua operação comercial. " +
    "(Rascunho SIMULADO — nenhum envio realizado. Conteúdo limitado a claims aprovados.)";
  await runAgent(store, {
    missionId: mission.id,
    agentId: "beacon",
    correlationId,
    steps: [
      { tool: "draft.create", action: "compose", inputRef: `lead:${lead.id}`, outputRef: "draft:pending", decision: { claimRefs: approved.map((c) => c.id) } },
      // tentativa de envio externo DEVE ser negada pela policy — evidência G04/G15
      { tool: "channel.send", action: "send_email", inputRef: "draft:pending" },
    ],
  });
  const draft = await store.createDraft({
    missionId: mission.id,
    leadId: lead.id,
    channel: "email",
    recipientPolicy: "synthetic_only",
    claimRefs: approvedClaimIds(),
    text: draftText,
    createdBy: "agent:beacon",
  });
  emit(store, "draft.created.v1", correlationId, {
    draftId: draft.id,
    channel: draft.channel,
    claimRefs: draft.claimRefs,
    simulated: true,
  }, { missionId: mission.id, agentId: "beacon" });
  await audit(store, "agent:beacon", "draft.create", "CommercialDraft", draft.id, correlationId, "allowed", { simulated: true, claimRefs: draft.claimRefs });

  await runAgent(store, {
    missionId: mission.id,
    agentId: "pledge",
    correlationId,
    steps: [
      { tool: "task.reminder", action: "create_reminder", inputRef: `lead:${lead.id}`, outputRef: "task:followup-review", decision: { dueInHours: 24, simulated: true } },
    ],
  });
  const reminder = await store.createTask({
    missionId: mission.id,
    assigneeId: "user:approver",
    title: "Revisar rascunho de abordagem (aprovação humana pendente)",
    correlationId,
    dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  await audit(store, "agent:pledge", "task.reminder", "Task", reminder.id, correlationId, "allowed", { simulated: true });

  const approval = await store.createApproval({
    missionId: mission.id,
    action: "draft.review",
    scope: `draft:${draft.id}`,
    reason: "Revisão humana obrigatória antes de qualquer uso do rascunho (L3 futuro; envio bloqueado na W00/W01)",
    preview: { draftId: draft.id, channel: draft.channel, simulated: true, textPreview: draft.text.slice(0, 140) },
    requestedBy: "agent:beacon",
    approverRole: "approver",
    correlationId,
  });
  emit(store, "approval.requested.v1", correlationId, {
    approvalId: approval.id,
    action: approval.action,
    requestedBy: approval.requestedBy,
    scope: approval.scope,
  }, { missionId: mission.id, agentId: "beacon" });
  await store.setMissionStatus(mission.id, "awaiting_approval");
  emit(store, "mission.status_changed.v1", correlationId, {
    missionId: mission.id,
    from: "running",
    to: "awaiting_approval",
  }, { missionId: mission.id });
  await audit(store, "agent:beacon", "approval.request", "ApprovalRequest", approval.id, correlationId, "allowed");

  

  return {
    correlationId,
    lead: (await store.getLead(lead.id))!,
    mission: (await store.getMission(mission.id))!,
    rubric,
    draft,
    approvalId: approval.id,
    simulated: true,
  };
}

/** Decisão humana sobre approval; retoma ou encerra a missão. Nunca envia nada. */
export async function decideApproval(
  store: StorePort,
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  reason?: string,
): Promise<{ approval: ApprovalRequest; missionStatus: Mission["status"] }> {
  const before = await store.getApproval(approvalId);
  if (!before) throw new Error(`approval não encontrada: ${approvalId}`);
  const correlationId = before.correlationId;
  const missionId = before.missionId;

  if (before.requestedBy === decidedBy) {
    await audit(store, decidedBy, "approval.self_decide", "ApprovalRequest", approvalId, correlationId, "denied", { reason: "auto-aprovação proibida" });
    emit(store, "audit.denied.v1", correlationId, {
      actor: decidedBy,
      action: "approval.self_decide",
      reason: "auto-aprovação proibida",
    }, { missionId, agentId: before.requestedBy });
    
    throw new Error("auto-aprovação proibida");
  }

  const approval = await store.decideApproval(approvalId, decision, decidedBy, reason);
  emit(store, "approval.decided.v1", correlationId, {
    approvalId: approval.id,
    decision: approval.decision,
    decidedBy: approval.decidedBy,
    ...(approval.decidedReason !== undefined ? { reason: approval.decidedReason } : {}),
  }, { missionId, agentId: approval.requestedBy });
  await audit(store, decidedBy, "approval.decide", "ApprovalRequest", approvalId, correlationId, "allowed", { decision });

  if (approval.action.startsWith("draft.")) {
    const draftId = String(approval.scope).replace("draft:", "");
    await store.setDraftStatus(draftId, decision === "approved" ? "approved" : "rejected");
    emit(store, "draft.decided.v1", correlationId, {
      draftId,
      decision,
      decidedBy,
    }, { missionId, agentId: approval.requestedBy });
    await audit(store, decidedBy, "draft.decide", "CommercialDraft", draftId, correlationId, "allowed", { decision });
  }

  const missionStatus: Mission["status"] = decision === "approved" ? "completed" : "cancelled";
  await store.setMissionStatus(missionId, missionStatus);
  emit(store, "mission.status_changed.v1", correlationId, {
    missionId,
    from: "awaiting_approval",
    to: missionStatus,
  }, { missionId });
  emit(store, "run.completed.v1", correlationId, {
    runId: `mission:${missionId}`,
    status: missionStatus,
    simulated: true,
  }, { missionId });
  
  return { approval, missionStatus };
}
