import { randomUUID } from "node:crypto";
import type { CreateLeadInput, Lead, Mission, RubricResult } from "@bgo/contracts";
import { evaluatePolicy } from "@bgo/agents";
import { eventBus, recordAudit } from "@bgo/observability";
import { Store } from "./store";
import { scoreLead } from "./rubric";
import { claimsForDraft, approvedClaimIds } from "./offer";
import type { CommercialDraft } from "./types";

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
  store: Store,
  eventType: Parameters<typeof eventBus.publish>[0]["eventType"],
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

function audit(
  store: Store,
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
    publishEvent: false, // auditoria vai ao store (mesma transação lógica); UI lê /api/audit
  });
  store.appendAudit(ev);
  return ev;
}

/** Executa um run mock de um agente: steps auditados com policy check. */
function runAgent(
  store: Store,
  input: {
    missionId: string;
    agentId: string;
    correlationId: string;
    steps: { tool: string; action: string; inputRef?: string; outputRef?: string; decision?: Record<string, unknown> }[];
  },
) {
  const run = store.createRun({
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
  audit(store, `agent:${input.agentId}`, "run.start", "ExecutionRun", run.id, input.correlationId, "allowed", { mock: true });

  store.setRunStatus(run.id, "running");
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
    store.addStep({
      runId: run.id,
      tool: s.tool,
      action: s.action,
      ...(s.inputRef !== undefined ? { inputRef: s.inputRef } : {}),      ...(s.outputRef !== undefined ? { outputRef: s.outputRef } : {}),
      decision: { policy: decision.allowed ? "allowed" : "denied", reason: decision.reason, level: decision.level, simulated: true },
    });
    if (!decision.allowed) {
      audit(store, `agent:${input.agentId}`, `${s.tool}.${s.action}`, "ExecutionStep", run.id, input.correlationId, "denied", { reason: decision.reason });
      emit(store, "audit.denied.v1", input.correlationId, {
        actor: `agent:${input.agentId}`,
        action: `${s.tool}.${s.action}`,
        reason: decision.reason,
      }, { missionId: input.missionId, agentId: input.agentId });
      store.setRunStatus(run.id, "failed", decision.reason);
      emit(store, "run.failed.v1", input.correlationId, {
        runId: run.id,
        error: decision.reason,
        simulated: true,
      }, { missionId: input.missionId, agentId: input.agentId });
      return store.getRun(run.id)!;
    }
    emit(store, "run.step.completed.v1", input.correlationId, {
      runId: run.id,
      stepSeq: store.listSteps(run.id).length,
      tool: s.tool,
      action: s.action,
      simulated: true,
    }, { missionId: input.missionId, agentId: input.agentId });
  }
  store.setRunStatus(run.id, "completed");
  emit(store, "run.completed.v1", input.correlationId, {
    runId: run.id,
    status: "completed",
    simulated: true,
  }, { missionId: input.missionId, agentId: input.agentId });
  audit(store, `agent:${input.agentId}`, "run.complete", "ExecutionRun", run.id, input.correlationId, "allowed", { simulated: true });
  return store.getRun(run.id)!;
}

/**
 * Fluxo demonstrativo Onda 00 (tudo SIMULADO):
 * lead sintético → missão Aegis → dispatch Relay → dossiê Scout →
 * qualificação Meridian → rascunho Beacon → lembrete Pledge → aprovação pendente.
 */
export function runDemoFlow(store: Store, input?: Partial<CreateLeadInput>): DemoFlowResult {
  const correlationId = randomUUID();
  const leadInput: CreateLeadInput = {
    name: "Lead Demo Sintético",
    email: "demo@synthetic.bgo.local",
    source: "demo_form",
    synthetic: true,
    ...(input ?? {}),
    consent: input?.consent ?? { channel: "email", optIn: true, at: now() },
  };

  // 1. Lead
  const lead = store.createLead(leadInput, "user:demo");
  emit(store, "lead.created.v1", correlationId, {
    leadId: lead.id,
    source: lead.source,
    synthetic: lead.synthetic,
    status: lead.status,
  });
  audit(store, "user:demo", "lead.create", "Lead", lead.id, correlationId, "allowed", { synthetic: true });

  // 2. Missão criada por Aegis
  const mission = store.createMission({
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
  store.setMissionStatus(mission.id, "queued");
  store.setMissionStatus(mission.id, "running");
  audit(store, "agent:aegis", "mission.create", "Mission", mission.id, correlationId, "allowed");

  // 3. Relay: atribuições + tasks
  const assignments = [
    { agentId: "relay", role: "coordenador" },
    { agentId: "scout", role: "pesquisa" },
    { agentId: "meridian", role: "qualificação" },
    { agentId: "beacon", role: "abordagem" },
    { agentId: "pledge", role: "acompanhamento" },
  ] as const;
  for (const a of assignments) {
    store.assign(mission.id, a.agentId, a.role, "agent:aegis");
    emit(store, "mission.assigned.v1", correlationId, {
      missionId: mission.id,
      assigneeId: a.agentId,
    }, { missionId: mission.id, agentId: a.agentId });
  }
  const relayTask = store.createTask({
    missionId: mission.id,
    assigneeId: "relay",
    title: "Distribuir etapas da missão e definir SLA interno",
    correlationId,
  });
  audit(store, "agent:relay", "task.dispatch", "Task", relayTask.id, correlationId, "allowed");
  store.setTaskStatus(relayTask.id, "done");

  // 4. Scout: dossiê simulado com proveniência
  runAgent(store, {
    missionId: mission.id,
    agentId: "scout",
    correlationId,
    steps: [
      { tool: "research.web", action: "search_account", inputRef: `lead:${lead.id}`, outputRef: "dossier:synthetic-account" },
      { tool: "research.web", action: "record_sources", outputRef: "sources:synthetic-3-urls" },
    ],
  });

  // 5. Meridian: qualificação
  const rubric = scoreLead(store.getLead(lead.id)!);
  runAgent(store, {
    missionId: mission.id,
    agentId: "meridian",
    correlationId,
    steps: [
      { tool: "lead.score", action: "apply_rubric", inputRef: `lead:${lead.id}`, outputRef: `rubric:${rubric.rubricVersion}`, decision: { score: rubric.score, recommendation: rubric.recommendation } },
      { tool: "lead.score", action: "record_gaps", outputRef: `gaps:${rubric.gaps.length}` },
    ],
  });
  if (rubric.recommendation === "qualified") {
    store.transitionLead(lead.id, "triage", "agent:meridian");
    emit(store, "lead.status_changed.v1", correlationId, { leadId: lead.id, from: "new", to: "triage" });
    store.transitionLead(lead.id, "qualified", "agent:meridian");
    emit(store, "lead.status_changed.v1", correlationId, { leadId: lead.id, from: "triage", to: "qualified" });
  }
  emit(store, "lead.qualified.v1", correlationId, {
    leadId: lead.id,
    score: rubric.score,
    rubricVersion: rubric.rubricVersion,
    gaps: rubric.gaps,
  }, { missionId: mission.id, agentId: "meridian" });
  audit(store, "agent:meridian", "lead.qualify", "Lead", lead.id, correlationId, "allowed", { score: rubric.score, simulated: true });

  // 6. Beacon: rascunho SOMENTE com claims aprovados
  const approved = claimsForDraft();
  const draftText =
    "Olá! Sou da equipe do Birthub Growth Office. Registramos seu interesse e gostaríamos de " +
    "conversar sobre como o Birthub 360° pode apoiar sua operação comercial. " +
    "(Rascunho SIMULADO — nenhum envio realizado. Conteúdo limitado a claims aprovados.)";
  const beaconRun = runAgent(store, {
    missionId: mission.id,
    agentId: "beacon",
    correlationId,
    steps: [
      { tool: "draft.create", action: "compose", inputRef: `lead:${lead.id}`, outputRef: "draft:pending", decision: { claimRefs: approved.map((c) => c.id) } },
      // tentativa de envio externo DEVE ser negada pela policy — evidência G04
      { tool: "channel.send", action: "send_email", inputRef: "draft:pending" },
    ],
  });
  void beaconRun;
  const draft = store.createDraft({
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
  audit(store, "agent:beacon", "draft.create", "CommercialDraft", draft.id, correlationId, "allowed", { simulated: true, claimRefs: draft.claimRefs });

  // 7. Pledge: lembrete interno
  const pledgeRun = runAgent(store, {
    missionId: mission.id,
    agentId: "pledge",
    correlationId,
    steps: [
      { tool: "task.reminder", action: "create_reminder", inputRef: `lead:${lead.id}`, outputRef: "task:followup-review", decision: { dueInHours: 24, simulated: true } },
    ],
  });
  void pledgeRun;
  const reminder = store.createTask({
    missionId: mission.id,
    assigneeId: "user:approver",
    title: "Revisar rascunho de abordagem (aprovação humana pendente)",
    correlationId,
    dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  });
  audit(store, "agent:pledge", "task.reminder", "Task", reminder.id, correlationId, "allowed", { simulated: true });

  // 8. Aprovação humana pendente — missão aguarda
  const approval = store.createApproval({
    missionId: mission.id,
    action: "draft.review",
    scope: `draft:${draft.id}`,
    reason: "Revisão humana obrigatória antes de qualquer uso do rascunho (L3 futuro; envio bloqueado na W00)",
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
  store.setMissionStatus(mission.id, "awaiting_approval");
  emit(store, "mission.status_changed.v1", correlationId, {
    missionId: mission.id,
    from: "running",
    to: "awaiting_approval",
  }, { missionId: mission.id });
  audit(store, "agent:beacon", "approval.request", "ApprovalRequest", approval.id, correlationId, "allowed");

  return {
    correlationId,
    lead: store.getLead(lead.id)!,
    mission: store.getMission(mission.id)!,
    rubric,
    draft,
    approvalId: approval.id,
    simulated: true,
  };
}

/** Decisão humana sobre approval; retoma ou encerra a missão. Nunca envia nada. */
export function decideApproval(
  store: Store,
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  reason?: string,
): { approval: ReturnType<Store["decideApproval"]>; missionStatus: Mission["status"] } {
  const before = store.getApproval(approvalId);
  if (!before) throw new Error(`approval não encontrada: ${approvalId}`);
  const correlationId = before.correlationId;
  const missionId = before.missionId;

  // Auto-aprovação proibida
  if (before.requestedBy === decidedBy) {
    audit(store, decidedBy, "approval.self_decide", "ApprovalRequest", approvalId, correlationId, "denied", { reason: "auto-aprovação proibida" });
    emit(store, "audit.denied.v1", correlationId, {
      actor: decidedBy,
      action: "approval.self_decide",
      reason: "auto-aprovação proibida",
    }, { missionId, agentId: before.requestedBy });
    throw new Error("auto-aprovação proibida");
  }

  const approval = store.decideApproval(approvalId, decision, decidedBy, reason);
  emit(store, "approval.decided.v1", correlationId, {
    approvalId: approval.id,
    decision: approval.decision,
    decidedBy: approval.decidedBy,
    ...(approval.decidedReason !== undefined ? { reason: approval.decidedReason } : {}),
  }, { missionId, agentId: approval.requestedBy });
  audit(store, decidedBy, "approval.decide", "ApprovalRequest", approvalId, correlationId, "allowed", { decision });

  if (approval.action.startsWith("draft.")) {
    const draftId = String(approval.scope).replace("draft:", "");
    store.setDraftStatus(draftId, decision === "approved" ? "approved" : "rejected");
    emit(store, "draft.decided.v1", correlationId, {
      draftId,
      decision,
      decidedBy,
    }, { missionId, agentId: approval.requestedBy });
    audit(store, decidedBy, "draft.decide", "CommercialDraft", draftId, correlationId, "allowed", { decision });
  }

  const missionStatus: Mission["status"] = decision === "approved" ? "completed" : "cancelled";
  store.setMissionStatus(missionId, missionStatus);
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
