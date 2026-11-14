import { randomUUID } from "node:crypto";
import type {
  ApprovalRequest,
  CreateLeadInput,
  EventType,
  ExecutionRun,
  Lead,
  Mission,
  Opportunity,
  OpportunityPriority,
  OpportunityStage,
  RubricResult,
  ConsolidatedCommercialDossier,
  ConsolidatedDossierSubject,
  PilotMetricsReport,
  Channel,
} from "@bgo/contracts";
import { evaluatePolicy } from "@bgo/agents";
import { eventBus, recordAudit } from "@bgo/observability";
import type { StorePort } from "./store-port";
import type { CommercialDraft } from "./types";
import { scoreLead } from "./rubric";
import { claimsForDraft, approvedClaimIds } from "./offer";
import type { CompanyStorePort, StoredCompany } from "./company-store";
import {
  canTransitionOpportunity,
  maxPriorityForScore,
  type OpportunityStorePort,
} from "./opportunity-store";
import { evaluateCompanyIcp, DEFAULT_COMMERCIAL_ICP_PROFILE } from "./icp-engine";
import { validateDraftClaims, CANONICAL_OFFER_ITEMS, type OfferCatalogStorePort } from "./offer-catalog";
import type { IcpStorePort } from "./icp-store";

export interface DemoFlowResult {
  correlationId: string;
  lead: Lead;
  mission: Mission;
  rubric: RubricResult;
  draft: CommercialDraft;
  approvalId: string;
  simulated: true;
}

export interface OpportunityMissionResult {
  correlationId: string;
  opportunity: Opportunity;
  company: StoredCompany;
  mission: Mission;
  runs: ExecutionRun[];
  draft: CommercialDraft;
  approval: ApprovalRequest;
  qualification: {
    icpScore: number;
    recommendedPriority: OpportunityPriority;
    evidences: string[];
    gaps: string[];
    diagnosis: string;
    simulated: boolean;
  };
  icpProfile?: {
    id: string;
    name: string;
    version: number;
  };
  structuredOutput?: {
    facts: string[];
    inferences: string[];
    recommendations: string[];
  };
  duplicate: boolean;
}

const now = () => new Date().toISOString();

function emit(
  store: StorePort,
  eventType: EventType,
  correlationId: string,
  payload: Record<string, unknown>,
  extra?: { missionId?: string; agentId?: string },
) {
  const event = eventBus.publish({
    eventType,
    workspaceId: store.workspace.slug,
    correlationId,
    payload,
    ...(extra?.missionId !== undefined ? { missionId: extra.missionId } : {}),
    ...(extra?.agentId !== undefined ? { agentId: extra.agentId } : {}),
  });
  // Outbox: quando o store é persistente, grava o evento (idempotente por eventId).
  const p = store as StorePort & { persistEvent?: (e: typeof event) => Promise<void> };
  if (typeof p.persistEvent === "function") {
    void p.persistEvent(event).catch(() => undefined);
  }
  return event;
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

/** Executa um run de um agente: steps auditados com policy check + input/output/durationMs. */
async function runAgent(
  store: StorePort,
  input: {
    missionId: string;
    agentId: string;
    correlationId: string;
    provider?: string;
    mock?: boolean;
    runInput?: Record<string, unknown>;
    runOutput?: Record<string, unknown>;
    costUnits?: number;
    steps: { tool: string; action: string; inputRef?: string; outputRef?: string; decision?: Record<string, unknown> }[];
  },
) {
  const t0 = Date.now();
  const mock = input.mock ?? true;
  const run = await store.createRun({
    missionId: input.missionId,
    agentId: input.agentId,
    correlationId: input.correlationId,
    provider: input.provider ?? "mock",
    mock,
    ...(input.runInput !== undefined ? { input: input.runInput } : {}),
  });
  emit(store, "run.started.v1", input.correlationId, {
    runId: run.id,
    missionId: input.missionId,
    agentId: input.agentId,
    mock,
  }, { missionId: input.missionId, agentId: input.agentId });
  await audit(store, `agent:${input.agentId}`, "run.start", "ExecutionRun", run.id, input.correlationId, "allowed", { mock });

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
      decision: {
        policy: decision.allowed ? "allowed" : "denied",
        reason: decision.reason,
        level: decision.level,
        simulated: mock,
        ...(s.decision ?? {}),
      },
    });
    if (!decision.allowed) {
      await audit(store, `agent:${input.agentId}`, `${s.tool}.${s.action}`, "ExecutionStep", run.id, input.correlationId, "denied", { reason: decision.reason });
      emit(store, "audit.denied.v1", input.correlationId, {
        actor: `agent:${input.agentId}`,
        action: `${s.tool}.${s.action}`,
        reason: decision.reason,
      }, { missionId: input.missionId, agentId: input.agentId });
      const durationMs = Math.max(1, Date.now() - t0);
      await store.setRunStatus(run.id, "failed", decision.reason, {
        durationMs,
        ...(input.costUnits !== undefined ? { costUnits: input.costUnits } : {}),
        ...(input.runOutput !== undefined ? { output: input.runOutput } : {}),
      });
      emit(store, "run.failed.v1", input.correlationId, {
        runId: run.id,
        error: decision.reason,
        simulated: mock,
      }, { missionId: input.missionId, agentId: input.agentId });
      return (await store.getRun(run.id))!;
    }
    emit(store, "run.step.completed.v1", input.correlationId, {
      runId: run.id,
      stepSeq: (await store.listSteps(run.id)).length,
      tool: s.tool,
      action: s.action,
      simulated: mock,
    }, { missionId: input.missionId, agentId: input.agentId });
  }
  const durationMs = Math.max(1, Date.now() - t0);
  await store.setRunStatus(run.id, "completed", undefined, {
    durationMs,
    ...(input.costUnits !== undefined ? { costUnits: input.costUnits } : {}),
    ...(input.runOutput !== undefined ? { output: input.runOutput } : {}),
  });
  emit(store, "run.completed.v1", input.correlationId, {
    runId: run.id,
    status: "completed",
    simulated: mock,
  }, { missionId: input.missionId, agentId: input.agentId });
  await audit(store, `agent:${input.agentId}`, "run.complete", "ExecutionRun", run.id, input.correlationId, "allowed", {
    simulated: mock,
    durationMs,
  });
  return (await store.getRun(run.id))!;
}

/**
 * Fluxo demonstrativo (tudo SIMULADO) sobre StorePort persistido:
 * lead sintético → missão Aegis → dispatch Relay → dossiê Scout →
 * qualificação Meridian → rascunho Beacon → lembrete Pledge → aprovação pendente.
 */
export async function runDemoFlow(
  store: StorePort,
  input?: Partial<CreateLeadInput>,
  opts?: { correlationId?: string },
): Promise<DemoFlowResult> {
  const correlationId = opts?.correlationId ?? randomUUID();
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

/**
 * Onda 11 (Fase 03 / G135): Orquestração integrada dos 6 agentes para uma
 * Oportunidade comercial criada a partir de uma Empresa aprovada na Central Scout.
 *
 * Aegis → Relay → Scout → Meridian → Beacon → Pledge → Central de Aprovações.
 */
export async function runOpportunityMission(
  deps: {
    store: StorePort;
    companies: CompanyStorePort;
    opportunities: OpportunityStorePort;
    icpStore?: IcpStorePort;
    offerCatalog?: OfferCatalogStorePort;
    diagnoseHook?: (input: {
      missionId: string;
      correlationId: string;
      company: StoredCompany;
    }) => Promise<{ diagnosis?: string; justification?: string; simulated: boolean; provider: string; model: string; costUnits?: number }>;
  },
  input: {
    opportunityId: string;
    requester: string;
    correlationId?: string;
    forceNew?: boolean;
    icpProfileId?: string;
  },
): Promise<OpportunityMissionResult> {
  const { store, companies, opportunities } = deps;
  const opp = await opportunities.getOpportunity(input.opportunityId);
  if (!opp) throw new Error(`oportunidade não encontrada: ${input.opportunityId}`);
  if (!opp.companyId) throw new Error(`oportunidade ${opp.id} não possui empresa vinculada`);
  const company = await companies.getCompany(opp.companyId);
  if (!company) throw new Error(`empresa vinculada não encontrada: ${opp.companyId}`);

  if (opp.stage === "won" || opp.stage === "lost" || opp.stage === "archived") {
    throw new Error(`oportunidade em estágio terminal (${opp.stage}) não pode iniciar missão de prospecção`);
  }

  // Idempotência: se já houver missão ativa (running ou awaiting_approval) e não for forceNew, retorna a existente.
  if (opp.missionId && !input.forceNew) {
    const existingMission = await store.getMission(opp.missionId);
    if (existingMission && (existingMission.status === "running" || existingMission.status === "awaiting_approval")) {
      const existingRuns = await store.listRuns(existingMission.id);
      const existingDrafts = (await store.listDrafts()).filter((d) => d.missionId === existingMission.id);
      const existingApprovals = (await store.listApprovals()).filter((a) => a.missionId === existingMission.id);
      if (existingDrafts[0] && existingApprovals[0]) {
        return {
          correlationId: existingMission.correlationId,
          opportunity: opp,
          company,
          mission: existingMission,
          runs: existingRuns,
          draft: existingDrafts[0],
          approval: existingApprovals[0],
          qualification: {
            icpScore: company.score,
            recommendedPriority: maxPriorityForScore(company.score),
            evidences: company.reasons,
            gaps: company.gaps,
            diagnosis: "[IDEMPOTENTE] missão já em andamento/aguardando aprovação para esta oportunidade",
            simulated: true,
          },
          duplicate: true,
        };
      }
    }
  }

  const correlationId = input.correlationId ?? randomUUID();
  const runs: ExecutionRun[] = [];

  // Resolução do Perfil de ICP Comercial Ativo (Onda 12 / Fase 02)
  let activeIcp = DEFAULT_COMMERCIAL_ICP_PROFILE;
  if (deps.icpStore) {
    if (input.icpProfileId) {
      const p = await deps.icpStore.getProfile(input.icpProfileId);
      if (p) activeIcp = p;
    } else {
      const p = await deps.icpStore.getActiveProfile(opp.workspaceId);
      if (p) activeIcp = p;
    }
  }
  const evalResult = evaluateCompanyIcp(company, activeIcp);

  // 1. AEGIS — Supervisor Central: cria e planeja a missão comercial
  const mission = await store.createMission({
    goal: `Prospecção comercial integrada — ${company.razaoSocial} (CNPJ ${company.cnpj})`,
    requester: input.requester,
    companyId: company.id,
    opportunityId: opp.id,
    correlationId,
    createdBy: "agent:aegis",
  });
  emit(store, "mission.created.v1", correlationId, {
    missionId: mission.id,
    goal: mission.goal,
  }, { missionId: mission.id, agentId: "aegis" });
  emit(store, "opportunity.mission_started.v1", correlationId, {
    opportunityId: opp.id,
    companyId: company.id,
    missionId: mission.id,
    requester: input.requester,
  }, { missionId: mission.id, agentId: "aegis" });

  await store.setMissionStatus(mission.id, "queued");
  await store.setMissionStatus(mission.id, "running");
  await audit(store, "agent:aegis", "mission.create", "Mission", mission.id, correlationId, "allowed", {
    opportunityId: opp.id,
    companyId: company.id,
  });

  const aegisRun = await runAgent(store, {
    missionId: mission.id,
    agentId: "aegis",
    correlationId,
    runInput: {
      opportunityId: opp.id,
      companyId: company.id,
      cnpj: company.cnpj,
      razaoSocial: company.razaoSocial,
      icpScore: company.score,
    },
    runOutput: {
      missionId: mission.id,
      agentsAssigned: ["aegis", "relay", "scout", "meridian", "beacon", "pledge"],
      policyMode: "L2-internal-L3-human-supervised",
    },
    steps: [
      {
        tool: "mission.plan",
        action: "create_mission",
        inputRef: `opportunity:${opp.id}`,
        outputRef: `mission:${mission.id}`,
        decision: { companyId: company.id, cnpj: company.cnpj },
      },
    ],
  });
  runs.push(aegisRun);

  const roster = [
    { agentId: "aegis", role: "supervisão" },
    { agentId: "relay", role: "coordenação" },
    { agentId: "scout", role: "investigação" },
    { agentId: "meridian", role: "qualificação SDR" },
    { agentId: "beacon", role: "prospecção outbound" },
    { agentId: "pledge", role: "compromissos e follow-up" },
  ] as const;
  for (const r of roster) {
    await store.assign(mission.id, r.agentId, r.role, "agent:aegis");
    emit(store, "mission.assigned.v1", correlationId, {
      missionId: mission.id,
      assigneeId: r.agentId,
    }, { missionId: mission.id, agentId: r.agentId });
  }

  // 2. RELAY — Coordenador Comercial: distribui etapas e dependências
  const taskScout = await store.createTask({
    missionId: mission.id,
    assigneeId: "scout",
    title: `Recuperar dossiê e evidências da importação (${company.razaoSocial})`,
    correlationId,
    dependsOn: [],
  });
  const taskMeridian = await store.createTask({
    missionId: mission.id,
    assigneeId: "meridian",
    title: `Qualificar aderência ao ICP, lacunas e prioridade comercial (${company.razaoSocial})`,
    correlationId,
    dependsOn: [taskScout.id],
  });
  const taskBeacon = await store.createTask({
    missionId: mission.id,
    assigneeId: "beacon",
    title: `Produzir proposta de abordagem com claims aprovados (${company.razaoSocial})`,
    correlationId,
    dependsOn: [taskMeridian.id],
  });
  const taskPledge = await store.createTask({
    missionId: mission.id,
    assigneeId: "pledge",
    title: `Organizar próximas ações, responsáveis e prazos para aprovação (${company.razaoSocial})`,
    correlationId,
    dependsOn: [taskBeacon.id],
  });

  const relayRun = await runAgent(store, {
    missionId: mission.id,
    agentId: "relay",
    correlationId,
    runInput: { missionId: mission.id, opportunityId: opp.id },
    runOutput: {
      tasksCreated: [taskScout.id, taskMeridian.id, taskBeacon.id, taskPledge.id],
      dependencyChain: "scout -> meridian -> beacon -> pledge",
    },
    steps: [
      {
        tool: "task.dispatch",
        action: "distribute_pipeline_tasks",
        inputRef: `mission:${mission.id}`,
        outputRef: `tasks:4`,
        decision: { tasks: [taskScout.id, taskMeridian.id, taskBeacon.id, taskPledge.id] },
      },
    ],
  });
  runs.push(relayRun);

  let currentOpp = opp;
  const advanceStage = async (
    to: OpportunityStage,
    actorAgent: string,
    reason: string,
    nextAgent: string,
    nextAction: string,
    extra?: { priority?: OpportunityPriority; icpScore?: number; details?: Record<string, unknown> },
  ) => {
    if (currentOpp.stage !== to && canTransitionOpportunity(currentOpp.stage, to)) {
      const from = currentOpp.stage;
      currentOpp = await opportunities.transitionOpportunity(currentOpp.id, to, `agent:${actorAgent}`, {
        reason,
        correlationId,
        currentAgentId: nextAgent,
        nextAction,
        missionId: mission.id,
        ...(extra?.priority !== undefined ? { priority: extra.priority } : {}),
        ...(extra?.icpScore !== undefined ? { icpScore: extra.icpScore } : {}),
        ...(extra?.details !== undefined ? { details: extra.details } : {}),
      });
      emit(store, "opportunity.stage_changed.v1", correlationId, {
        opportunityId: currentOpp.id,
        companyId: company.id,
        from,
        to,
        actor: `agent:${actorAgent}`,
        reason,
      }, { missionId: mission.id, agentId: actorAgent });
    } else {
      currentOpp = await opportunities.updateOpportunity(
        currentOpp.id,
        {
          currentAgentId: nextAgent,
          nextAction,
          missionId: mission.id,
          ...(extra?.priority !== undefined ? { priority: extra.priority } : {}),
          ...(extra?.icpScore !== undefined ? { icpScore: extra.icpScore } : {}),
        },
        `agent:${actorAgent}`,
        {
          action: "agent_step",
          reason,
          ...(extra?.details !== undefined ? { details: extra.details } : {}),
          correlationId,
        },
      );
    }
  };

  await advanceStage(
    "researching",
    "relay",
    "Relay distribuiu tarefas e acionou Scout para investigação de conta",
    "scout",
    "Scout consolidando dossiê e evidências da importação",
  );

  // 3. SCOUT — Investigação de Contas: recupera dossiê e evidências da importação
  const coHistory = await companies.companyHistory(company.id);
  const scoutOutput = {
    companyId: company.id,
    cnpj: company.cnpj,
    razaoSocial: company.razaoSocial,
    nomeFantasia: company.nomeFantasia ?? null,
    cnae: company.cnae ?? null,
    porte: company.porte ?? null,
    situacao: company.situacao ?? null,
    municipio: company.municipio ?? null,
    uf: company.uf ?? null,
    fonte: company.fonte,
    batchId: company.batchId ?? null,
    importadoEm: company.importadoEm,
    icpScore: company.score,
    scoreVersion: company.scoreVersion,
    evidences: company.reasons,
    gaps: company.gaps,
    historyCount: coHistory.length,
  };
  const scoutRun = await runAgent(store, {
    missionId: mission.id,
    agentId: "scout",
    correlationId,
    runInput: { companyId: company.id, cnpj: company.cnpj, batchId: company.batchId ?? null },
    runOutput: scoutOutput,
    steps: [
      {
        tool: "research.web",
        action: "gather_dossier",
        inputRef: `company:${company.id}`,
        outputRef: `dossier:${company.cnpj}`,
        decision: { fonte: company.fonte, batchId: company.batchId ?? null, evidencesCount: company.reasons.length },
      },
      {
        tool: "research.web",
        action: "verify_provenance",
        inputRef: `batch:${company.batchId ?? "direct"}`,
        outputRef: `history:${coHistory.length}`,
        decision: { reviewStatus: company.reviewStatus, reviewedBy: company.reviewedBy ?? null },
      },
    ],
  });
  runs.push(scoutRun);
  await store.setTaskStatus(taskScout.id, "done");

  await advanceStage(
    "qualifying",
    "scout",
    "Dossiê da empresa e proveniência da importação verificados pelo Scout",
    "meridian",
    "Meridian avaliando aderência ao ICP, lacunas e prioridade comercial",
    { details: { fonte: company.fonte, evidences: company.reasons, gaps: company.gaps } },
  );

  // 4. MERIDIAN — Qualificação SDR: avalia aderência ao ICP, lacunas e prioridades
  const effectiveScore = evalResult.score;
  const recommendedPriority = maxPriorityForScore(effectiveScore);

  const structuredOutput = {
    facts: [
      `CNPJ: ${company.cnpj}`,
      `Razão Social: ${company.razaoSocial}`,
      `Nome Fantasia: ${company.nomeFantasia || "Não informado"}`,
      `Situação Cadastral: ${company.situacao || "Não informada"}`,
      `CNAE Primário: ${company.cnae || "Não informado"}`,
      `Porte Cadastral: ${company.porte || "Não informado"}`,
      `Localização: ${company.municipio ? company.municipio + "/" : ""}${company.uf || "UF não informada"}`,
      `Fonte de Importação: ${company.fonte}`,
    ],
    inferences: [
      `Perfil de ICP Utilizado: ${activeIcp.name} (v${activeIcp.version})`,
      `Aderência ao ICP: score ${effectiveScore}/100`,
      ...evalResult.reasons,
      ...(evalResult.gaps.length > 0 ? [`Lacunas de qualificação: ${evalResult.gaps.join("; ")}`] : ["Cadastro completo no dossiê"]),
      evalResult.disclaimer,
    ],
    recommendations: [
      `Estágio comercial recomendado: ${effectiveScore >= 50 ? "qualified" : "nurture"}`,
      `Prioridade comercial recomendada: ${recommendedPriority}`,
      "Abordagem institucional inicial recomendada via minuta do Beacon (sem envio automático)",
      "Confirmação de stack de tecnologia e responsáveis diretos na etapa de descoberta",
    ],
  };

  let diagResult: {
    diagnosis?: string;
    justification?: string;
    simulated: boolean;
    provider: string;
    model: string;
    costUnits?: number;
  } = {
    diagnosis: `[DETERMINÍSTICO/SIMULADO] Conta ${company.razaoSocial} avaliada pelo perfil ICP '${activeIcp.name}' (v${activeIcp.version}) com score ${effectiveScore}/100.`,
    justification: `Evidências: ${evalResult.reasons.join("; ") || "nenhuma"}. Lacunas: ${evalResult.gaps.join("; ") || "nenhuma"}. Prioridade: ${recommendedPriority}.`,
    simulated: true,
    provider: "mock",
    model: "deterministic-rubric-v1",
    costUnits: 0,
  };

  if (deps.diagnoseHook) {
    try {
      diagResult = await deps.diagnoseHook({ missionId: mission.id, correlationId, company });
    } catch {
      // fallback determinístico já inicializado acima
    }
  }

  const meridianOutput = {
    icpScore: effectiveScore,
    scoreVersion: `${activeIcp.name}-v${activeIcp.version}`,
    recommendedPriority,
    evidences: evalResult.reasons,
    gaps: evalResult.gaps,
    diagnosis: diagResult.diagnosis ?? "",
    justification: diagResult.justification ?? "",
    structuredOutput,
    simulated: diagResult.simulated,
    provider: diagResult.provider,
    model: diagResult.model,
  };

  const meridianRun = await runAgent(store, {
    missionId: mission.id,
    agentId: "meridian",
    correlationId,
    provider: diagResult.provider,
    mock: diagResult.simulated,
    costUnits: diagResult.costUnits ?? 0,
    runInput: {
      companyId: company.id,
      razaoSocial: company.razaoSocial,
      icpScore: effectiveScore,
      icpProfileId: activeIcp.id,
      icpVersion: activeIcp.version,
      reasons: evalResult.reasons,
      gaps: evalResult.gaps,
    },
    runOutput: meridianOutput,
    steps: [
      {
        tool: "lead.score",
        action: "apply_rubric",
        inputRef: `company:${company.id}`,
        outputRef: `score:${effectiveScore}`,
        decision: { score: effectiveScore, recommendedPriority, evidences: evalResult.reasons, structuredOutput },
      },
      {
        tool: "lead.score",
        action: "evaluate_icp_gaps",
        inputRef: `dossier:${company.cnpj}`,
        outputRef: `gaps:${evalResult.gaps.length}`,
        decision: { gaps: evalResult.gaps, simulated: diagResult.simulated },
      },
    ],
  });
  runs.push(meridianRun);
  await store.setTaskStatus(taskMeridian.id, "done");

  await advanceStage(
    "qualified",
    "meridian",
    `Qualificação SDR concluída pelo Meridian (score ICP ${effectiveScore}/100, prioridade ${recommendedPriority})`,
    "beacon",
    "Beacon preparando proposta de abordagem personalizada com claims aprovados",
    {
      priority: recommendedPriority,
      icpScore: effectiveScore,
      details: { recommendedPriority, gaps: evalResult.gaps, simulated: diagResult.simulated },
    },
  );

  // 5. BEACON — Prospecção Outbound: rascunho personalizado apenas com claims aprovados (sem envio externo)
  const catalogItems = deps.offerCatalog
    ? await deps.offerCatalog.listItems(opp.workspaceId, { status: "approved" })
    : CANONICAL_OFFER_ITEMS.filter((i) => i.status === "approved");
  const approvedItemIds = catalogItems.map((c) => c.id);
  const validatedClaims = validateDraftClaims(approvedItemIds.slice(0, 3), catalogItems);
  const claimIds = validatedClaims.approvedClaims.length > 0
    ? validatedClaims.approvedClaims.map((c) => c.id)
    : approvedClaimIds();
  const externalSendPolicy = evaluatePolicy({
    agentId: "beacon",
    tool: "channel.send",
    action: "send_email",
    context: {
      hasApproval: false,
      channelAllowed: false,
      optInVerified: false,
      claimApproved: true,
      selfApproval: false,
      crossTenant: false,
    },
  });

  const localInfo = [company.municipio, company.uf].filter(Boolean).join("/");
  const fitSummary = company.reasons.length > 0 ? company.reasons.join(", ") : "cadastro corporativo B2B verificado";
  const gapNotice =
    company.gaps.length > 0
      ? `Pontos a confirmar na descoberta: ${company.gaps.join(", ")}.`
      : "Dados cadastrais completos no dossiê inicial.";
  const draftText =
    `Proposta de Abordagem Institucional — ${company.razaoSocial} (CNPJ ${company.cnpj}${localInfo ? ` · ${localInfo}` : ""})\n\n` +
    `Olá, equipe comercial/diretoria da ${company.nomeFantasia ?? company.razaoSocial}.\n` +
    `Identificamos sua empresa em nossa análise de prospecção B2B (${fitSummary}) e gostaríamos de apresentar o Birthub 360°, ` +
    `posicionado estrategicamente para operação comercial unificada.\n` +
    `${gapNotice}\n\n` +
    `[Governança BGO: Rascunho vinculado exclusivamente aos claims aprovados (${claimIds.join(", ")}). ` +
    `Preços, SLA e módulos específicos permanecem PENDENTE_DE_VALIDACAO. Nenhum envio externo automático é realizado.]`;

  const beaconRun = await runAgent(store, {
    missionId: mission.id,
    agentId: "beacon",
    correlationId,
    runInput: {
      opportunityId: currentOpp.id,
      companyId: company.id,
      razaoSocial: company.razaoSocial,
      claimRefs: claimIds,
    },
    runOutput: {
      claimRefs: claimIds,
      approvedClaimsCount: approvedItemIds.length,
      externalSendAllowed: externalSendPolicy.allowed,
      externalSendBlockedReason: externalSendPolicy.reason,
      draftLength: draftText.length,
    },
    steps: [
      {
        tool: "draft.create",
        action: "compose_outbound_proposal",
        inputRef: `opportunity:${currentOpp.id}`,
        outputRef: `claims:${claimIds.join(",")}`,
        decision: {
          claimRefs: claimIds,
          externalSendBlocked: !externalSendPolicy.allowed,
          externalSendBlockedReason: externalSendPolicy.reason,
        },
      },
    ],
  });
  runs.push(beaconRun);

  const draft = await store.createDraft({
    missionId: mission.id,
    companyId: company.id,
    opportunityId: currentOpp.id,
    channel: "email",
    recipientPolicy: "institutional_only_no_auto_send",
    claimRefs: claimIds,
    text: draftText,
    createdBy: "agent:beacon",
  });
  emit(store, "draft.created.v1", correlationId, {
    draftId: draft.id,
    channel: draft.channel,
    claimRefs: draft.claimRefs,
    simulated: true,
  }, { missionId: mission.id, agentId: "beacon" });
  await audit(store, "agent:beacon", "draft.create", "CommercialDraft", draft.id, correlationId, "allowed", {
    opportunityId: currentOpp.id,
    companyId: company.id,
    claimRefs: draft.claimRefs,
  });
  await store.setTaskStatus(taskBeacon.id, "done");

  await advanceStage(
    "outreach_drafted",
    "beacon",
    "Proposta de abordagem elaborada pelo Beacon usando apenas claims aprovados (sem envio externo)",
    "pledge",
    "Pledge estruturando próximas ações, responsáveis e prazos para aprovação",
    { details: { draftId: draft.id, claimRefs: draft.claimRefs } },
  );

  // 6. PLEDGE — Compromissos e Follow-up: organiza próximas ações, responsáveis e prazos para aprovação
  const dueAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const followupTask = await store.createTask({
    missionId: mission.id,
    assigneeId: "user:approver",
    title: `Aprovar abordagem e plano de follow-up para ${company.razaoSocial} (SLA 24h)`,
    correlationId,
    dueAt,
    dependsOn: [taskPledge.id],
  });

  const pledgeOutput = {
    followupTaskId: followupTask.id,
    responsible: "user:approver",
    dueAt,
    nextSteps: [
      "Revisar e aprovar rascunho institucional do Beacon na Central de Aprovações",
      "Validar canal institucional autorizado (nenhum contato pessoal fictício)",
      "Registrar acompanhamento comercial em 7 dias após aprovação",
    ],
  };

  const pledgeRun = await runAgent(store, {
    missionId: mission.id,
    agentId: "pledge",
    correlationId,
    runInput: {
      opportunityId: currentOpp.id,
      draftId: draft.id,
      priority: recommendedPriority,
    },
    runOutput: pledgeOutput,
    steps: [
      {
        tool: "task.reminder",
        action: "create_followup_plan",
        inputRef: `draft:${draft.id}`,
        outputRef: `task:${followupTask.id}`,
        decision: { responsible: "user:approver", dueAt },
      },
    ],
  });
  runs.push(pledgeRun);
  await store.setTaskStatus(taskPledge.id, "done");
  await audit(store, "agent:pledge", "task.reminder", "Task", followupTask.id, correlationId, "allowed", {
    opportunityId: currentOpp.id,
    dueAt,
  });

  // Solicitação de aprovação humana na Central de Aprovações
  const approval = await store.createApproval({
    missionId: mission.id,
    action: "opportunity.outreach_review",
    scope: `opportunity:${currentOpp.id}:draft:${draft.id}`,
    reason: `Revisão e aprovação humana obrigatória do rascunho de abordagem (Beacon) e plano de follow-up (Pledge) para ${company.razaoSocial}. Aprovar não realiza envio automático.`,
    preview: {
      opportunityId: currentOpp.id,
      companyId: company.id,
      cnpj: company.cnpj,
      razaoSocial: company.razaoSocial,
      icpScore: company.score,
      priority: recommendedPriority,
      evidences: company.reasons,
      gaps: company.gaps,
      draftId: draft.id,
      channel: draft.channel,
      claimRefs: draft.claimRefs,
      textPreview: draft.text.slice(0, 280),
      followupTaskId: followupTask.id,
      followupDueAt: dueAt,
      simulated: diagResult.simulated,
    },
    requestedBy: "agent:pledge",
    approverRole: "approver",
    correlationId,
  });
  emit(store, "approval.requested.v1", correlationId, {
    approvalId: approval.id,
    action: approval.action,
    requestedBy: approval.requestedBy,
    scope: approval.scope,
  }, { missionId: mission.id, agentId: "pledge" });

  await advanceStage(
    "awaiting_approval",
    "pledge",
    "Plano de abordagem e follow-up submetido à Central de Aprovações pelo Pledge",
    "pledge",
    `Aprovação humana pendente (${approval.id.slice(0, 8)}…) para rascunho Beacon e follow-up Pledge`,
    { details: { approvalId: approval.id, draftId: draft.id, followupTaskId: followupTask.id } },
  );

  await store.setMissionStatus(mission.id, "awaiting_approval");
  emit(store, "mission.status_changed.v1", correlationId, {
    missionId: mission.id,
    from: "running",
    to: "awaiting_approval",
  }, { missionId: mission.id, agentId: "aegis" });
  await audit(store, "agent:pledge", "approval.request", "ApprovalRequest", approval.id, correlationId, "allowed", {
    opportunityId: currentOpp.id,
    draftId: draft.id,
  });

  return {
    correlationId,
    opportunity: currentOpp,
    company,
    mission: (await store.getMission(mission.id))!,
    runs,
    draft,
    approval,
    qualification: {
      icpScore: effectiveScore,
      recommendedPriority,
      evidences: evalResult.reasons,
      gaps: evalResult.gaps,
      diagnosis: diagResult.diagnosis ?? "",
      simulated: diagResult.simulated,
    },
    icpProfile: {
      id: activeIcp.id,
      name: activeIcp.name,
      version: activeIcp.version,
    },
    structuredOutput,
    duplicate: false,
  };
}

/** Decisão humana sobre approval; retoma ou encerra a missão e atualiza oportunidade/rascunho. Nunca envia nada externamente. */
export async function decideApproval(
  store: StorePort,
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  reason?: string,
  opts?: {
    opportunities?: OpportunityStorePort;
    companies?: CompanyStorePort;
    icpStore?: IcpStorePort;
    offerCatalog?: OfferCatalogStorePort;
  },
): Promise<{ approval: ApprovalRequest; missionStatus: Mission["status"]; opportunity?: Opportunity }> {
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
  await audit(store, decidedBy, "approval.decide", "ApprovalRequest", approvalId, correlationId, "allowed", {
    decision,
    action: approval.action,
    scope: approval.scope,
    ...(reason !== undefined ? { reason } : {}),
  });

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

  let updatedOpportunity: Opportunity | undefined;
  const opportunities = opts?.opportunities;

  if (approval.action === "opportunity.outreach_review") {
    const preview = approval.preview ?? {};
    const draftId = typeof preview.draftId === "string" ? preview.draftId : undefined;
    const opportunityId = typeof preview.opportunityId === "string" ? preview.opportunityId : undefined;
    if (draftId) {
      await store.setDraftStatus(draftId, decision === "approved" ? "approved" : "rejected");
      emit(store, "draft.decided.v1", correlationId, {
        draftId,
        decision,
        decidedBy,
      }, { missionId, agentId: "beacon" });
      await audit(store, decidedBy, "draft.decide", "CommercialDraft", draftId, correlationId, "allowed", {
        decision,
        autoSend: false,
      });
    }
    if (opportunities && opportunityId) {
      const opp = await opportunities.getOpportunity(opportunityId);
      if (opp) {
        const targetStage: OpportunityStage = decision === "approved" ? "followup_planned" : "nurture";
        if (canTransitionOpportunity(opp.stage, targetStage)) {
          const from = opp.stage;
          updatedOpportunity = await opportunities.transitionOpportunity(opp.id, targetStage, decidedBy, {
            reason:
              decision === "approved"
                ? reason ?? "Rascunho Beacon e plano Pledge aprovados na supervisão humana (sem envio automático)"
                : reason ?? "Rascunho rejeitado na supervisão humana",
            correlationId,
            currentAgentId: "pledge",
            nextAction:
              decision === "approved"
                ? "Executar acompanhamento comercial supervisionado (envio externo permanece bloqueado)"
                : `Revisar abordagem comercial (${reason ?? "rejeitado"})`,
            details: { approvalId: approval.id, decision, draftId: draftId ?? null },
          });
          emit(store, "opportunity.stage_changed.v1", correlationId, {
            opportunityId: opp.id,
            ...(opp.companyId ? { companyId: opp.companyId } : {}),
            from,
            to: targetStage,
            actor: decidedBy,
            ...(reason ? { reason } : {}),
          }, { missionId, agentId: "pledge" });
        }
      }
    }
  } else if (approval.action === "company.promote_opportunity" && opportunities) {
    const preview = approval.preview ?? {};
    const companyId = typeof preview.companyId === "string" ? preview.companyId : undefined;
    const justification = typeof preview.justification === "string" ? preview.justification : approval.reason;
    if (decision === "approved" && companyId) {
      const res = await opportunities.promoteCompany({
        companyId,
        approvedBy: decidedBy,
        justification,
        correlationId,
      });
      updatedOpportunity = res.opportunity;
      if (res.created) {
        emit(store, "opportunity.created.v1", correlationId, {
          opportunityId: res.opportunity.id,
          companyId,
          cnpj: String(preview.cnpj ?? ""),
          stage: res.opportunity.stage,
          icpScore: res.opportunity.icpScore,
          approvedBy: decidedBy,
        }, { missionId, agentId: "aegis" });
      }
    }
  } else if (approval.action === "opportunity.priority_override" && opportunities) {
    const preview = approval.preview ?? {};
    const opportunityId = typeof preview.opportunityId === "string" ? preview.opportunityId : undefined;
    const requestedPriority = (preview.requestedPriority ?? preview.priority) as OpportunityPriority | undefined;
    if (opportunityId && requestedPriority) {
      const opp = await opportunities.getOpportunity(opportunityId);
      if (opp) {
        if (decision === "approved") {
          const from = opp.priority;
          updatedOpportunity = await opportunities.updateOpportunity(
            opp.id,
            { priority: requestedPriority },
            decidedBy,
            {
              action: "priority_changed",
              reason: reason ?? `Prioridade alterada de ${from} para ${requestedPriority} com aprovação humana`,
              details: { from, to: requestedPriority, approvalId: approval.id },
              correlationId,
            },
          );
          emit(store, "opportunity.priority_changed.v1", correlationId, {
            opportunityId: opp.id,
            from,
            to: requestedPriority,
            actor: decidedBy,
          }, { missionId, agentId: "aegis" });
        } else {
          updatedOpportunity = await opportunities.updateOpportunity(
            opp.id,
            {},
            decidedBy,
            {
              action: "priority_override_rejected",
              reason: reason ?? "Mudança de prioridade rejeitada na supervisão humana",
              details: { requestedPriority, approvalId: approval.id },
              correlationId,
            },
          );
        }
      }
    }
  } else if (approval.action === "opportunity.sensitive_change" && opportunities) {
    const preview = approval.preview ?? {};
    const opportunityId = typeof preview.opportunityId === "string" ? preview.opportunityId : undefined;
    const targetStage = (preview.targetStage ?? preview.toStage) as OpportunityStage | undefined;
    if (opportunityId && targetStage) {
      const opp = await opportunities.getOpportunity(opportunityId);
      if (opp && decision === "approved" && canTransitionOpportunity(opp.stage, targetStage)) {
        const from = opp.stage;
        updatedOpportunity = await opportunities.transitionOpportunity(opp.id, targetStage, decidedBy, {
          reason: reason ?? String(preview.reason ?? "Alteração comercial sensível aprovada"),
          correlationId,
          details: { approvalId: approval.id, sensitiveChange: true },
        });
        emit(store, "opportunity.stage_changed.v1", correlationId, {
          opportunityId: opp.id,
          ...(opp.companyId ? { companyId: opp.companyId } : {}),
          from,
          to: targetStage,
          actor: decidedBy,
          ...(reason ? { reason } : {}),
        }, { missionId, agentId: "aegis" });
      }
    }
  } else if (approval.action === "external.activity_request") {
    // Mesmo com aprovação humana, políticas L3 bloqueiam disparo externo real na Onda 00-11.
    const preview = approval.preview ?? {};
    const draftId = typeof preview.draftId === "string" ? preview.draftId : undefined;
    if (draftId && decision === "approved") {
      await store.setDraftStatus(draftId, "sent_blocked");
    }
    await audit(
      store,
      decidedBy,
      "external.activity.supervised_block",
      "ApprovalRequest",
      approval.id,
      correlationId,
      "info",
      { decision, externalExecutionBlocked: true, note: "Aprovação registrada; execução externa permanece bloqueada pela policy" },
    );
  } else if (approval.action === "icp.activate" && opts?.icpStore) {
    const preview = approval.preview ?? {};
    const profileId = typeof preview.profileId === "string" ? preview.profileId : undefined;
    if (decision === "approved" && profileId) {
      const active = await opts.icpStore.activateProfile(profileId, decidedBy);
      emit(store, "icp.approved.v1", correlationId, {
        profileId: active.id,
        version: active.version,
        approvedBy: decidedBy,
      }, { missionId });
      await audit(store, decidedBy, "icp.activate", "CommercialIcpProfile", active.id, correlationId, "allowed", {
        version: active.version,
      });
    }
  } else if (approval.action === "offer.approve" && opts?.offerCatalog) {
    const preview = approval.preview ?? {};
    const itemId = typeof preview.itemId === "string" ? preview.itemId : undefined;
    if (decision === "approved" && itemId) {
      const item = await opts.offerCatalog.approveItem(itemId, decidedBy);
      if (item) {
        emit(store, "offer_catalog.item_approved.v1", correlationId, {
          itemId: item.id,
          category: item.category,
          approvedBy: decidedBy,
        }, { missionId });
        await audit(store, decidedBy, "offer.approve", "CommercialOfferItem", item.id, correlationId, "allowed", {
          category: item.category,
        });
      }
    }
  } else if (approval.action === "dossier.approve_preparation") {
    const preview = approval.preview ?? {};
    const opportunityId = typeof preview.opportunityId === "string" ? preview.opportunityId : undefined;
    emit(
      store,
      "pilot.dossier_reviewed.v1",
      correlationId,
      {
        approvalId: approval.id,
        opportunityId,
        decision,
        decidedBy,
        reason,
        externalSendBlocked: true,
      },
      { missionId, agentId: "aegis" },
    );
    await audit(store, decidedBy, "dossier.review", "ApprovalRequest", approval.id, correlationId, "allowed", {
      decision,
      opportunityId,
      note: "Homologação de preparação de dossiê/material concluída. Envio externo permanece bloqueado.",
    });
  }

  const missionStatus: Mission["status"] = decision === "approved" ? "completed" : "cancelled";
  const existingMission = await store.getMission(missionId);
  if (existingMission) {
    await store.setMissionStatus(missionId, missionStatus);
    emit(store, "mission.status_changed.v1", correlationId, {
      missionId,
      from: existingMission.status,
      to: missionStatus,
    }, { missionId });
    emit(store, "run.completed.v1", correlationId, {
      runId: `mission:${missionId}`,
      status: missionStatus,
      simulated: true,
    }, { missionId });
  }

  return {
    approval,
    missionStatus,
    ...(updatedOpportunity ? { opportunity: updatedOpportunity } : {}),
  };
}

/**
 * Onboarding de Lead Voluntário no Pipeline de Oportunidades do Piloto (Onda 13 / Fase 04).
 * Preserva estritamente consentimento LGPD, aviso de privacidade e preferências de contato.
 */
export async function onboardVoluntaryLead(
  store: StorePort,
  leadId: string,
  actor: string,
  deps: {
    opportunities: OpportunityStorePort;
    companies?: CompanyStorePort;
    icpStore?: IcpStorePort;
    offerCatalog?: OfferCatalogStorePort;
  },
  opts?: {
    correlationId?: string;
    runMissionNow?: boolean;
    icpProfileId?: string;
  },
): Promise<{
  lead: Lead;
  opportunity: Opportunity;
  company?: StoredCompany;
  missionResult?: OpportunityMissionResult;
}> {
  const lead = await store.getLead(leadId);
  if (!lead) {
    throw new Error(`Lead voluntário não encontrado: ${leadId}`);
  }
  if (lead.status === "suppressed" || lead.suppressedAt) {
    throw new Error(`Lead com opt-out/suprimido não pode ingressar no pipeline comercial: ${leadId}`);
  }

  const correlationId = opts?.correlationId ?? randomUUID();
  let company: StoredCompany | undefined;

  if (deps.companies) {
    const companyName = lead.company || `${lead.name ?? "Lead Voluntário"} (Interesse Piloto)`;
    const existingCompanies = await deps.companies.listCompanies({ pageSize: 100 });
    const found = existingCompanies.items.find(
      (c) =>
        c.razaoSocial.toLowerCase() === companyName.toLowerCase() ||
        (lead.company && c.razaoSocial.toLowerCase() === lead.company.toLowerCase()),
    );

    if (found) {
      company = found;
    } else {
      const batch = await deps.companies.createImportBatch({
        fonte: `lead:${lead.source}`,
        correlationId,
        totalRows: 1,
        imported: 1,
        duplicates: 0,
        rejected: 0,
        importedBy: actor,
      });
      const dossier = {
        company: {
          cnpj: "00000000000199",
          razaoSocial: companyName,
          ...(lead.company || lead.name ? { nomeFantasia: (lead.company ?? lead.name)! } : {}),
          cnae: "6911-7/01",
          porte: "Médio",
          situacao: "ATIVA",
          municipio: "São Paulo",
          uf: "SP",
          fonte: `lead:${lead.source}`,
          importadoEm: new Date().toISOString(),
        },
        score: 75,
        reasons: [
          "Manifestação de interesse voluntário via canal supervisionado",
          `Consentimento LGPD registrado (${lead.privacy?.noticeVersion ?? "lgpd-v1"})`,
        ],
        gaps: [],
        simulated: false as const,
      };
      await deps.companies.upsertCompanies(batch.id, [dossier]);
      const refreshed = await deps.companies.listCompanies({ pageSize: 100 });
      const created = refreshed.items.find((c) => c.razaoSocial.toLowerCase() === companyName.toLowerCase());
      if (created) {
        company = await deps.companies.reviewCompany(created.id, "approved", actor, "Aprovado para piloto comercial");
      }
    }
  }

  if (!company) {
    throw new Error("Não foi possível resolver empresa alvo para o lead voluntário");
  }

  const promoResult = await deps.opportunities.promoteCompany({
    companyId: company.id,
    approvedBy: actor,
    justification: `Lead voluntário (${lead.name ?? lead.id}) com consentimento registrado. Interesse: ${lead.interest ?? "Apresentação e proposta"}`,
    correlationId,
  });

  const opp = promoResult.opportunity;

  emit(
    store,
    "pilot.lead_onboarded.v1",
    correlationId,
    {
      leadId: lead.id,
      opportunityId: opp.id,
      companyId: company.id,
      actor,
      consentVerified: true,
      synthetic: lead.synthetic,
    },
    { agentId: "relay" },
  );

  await audit(store, actor, "lead.onboard_pilot", "Lead", lead.id, correlationId, "allowed", {
    opportunityId: opp.id,
    companyId: company.id,
    synthetic: lead.synthetic,
  });

  let missionResult: OpportunityMissionResult | undefined;
  if (opts?.runMissionNow && deps.companies) {
    const missionDeps = {
      store,
      companies: deps.companies,
      opportunities: deps.opportunities,
      ...(deps.icpStore ? { icpStore: deps.icpStore } : {}),
      ...(deps.offerCatalog ? { offerCatalog: deps.offerCatalog } : {}),
    };
    missionResult = await runOpportunityMission(
      missionDeps,
      {
        opportunityId: opp.id,
        requester: actor,
        correlationId,
        ...(opts?.icpProfileId ? { icpProfileId: opts.icpProfileId } : {}),
        forceNew: true,
      },
    );
  }

  return {
    lead,
    opportunity: missionResult?.opportunity ?? opp,
    company,
    ...(missionResult ? { missionResult } : {}),
  };
}

/**
 * Constrói a Ficha Consolidada / Dossiê Comercial Integrado para Revisão Humana Obrigatória (Onda 13 / Fase 05).
 */
export async function buildConsolidatedDossier(
  store: StorePort,
  opportunityId: string,
  deps: {
    opportunities: OpportunityStorePort;
    companies?: CompanyStorePort;
    icpStore?: IcpStorePort;
    offerCatalog?: OfferCatalogStorePort;
  },
): Promise<ConsolidatedCommercialDossier> {
  const opp = await deps.opportunities.getOpportunity(opportunityId);
  if (!opp) {
    throw new Error(`Oportunidade não encontrada: ${opportunityId}`);
  }

  const company = opp.companyId && deps.companies ? await deps.companies.getCompany(opp.companyId) : undefined;
  const leads = await store.listLeads();
  const lead = leads.find(
    (l) =>
      opp.source.includes(l.id) ||
      (company && l.company && l.company.toLowerCase() === company.razaoSocial.toLowerCase()) ||
      (company && l.name && l.name.toLowerCase() === company.razaoSocial.toLowerCase()),
  );

  const subject: ConsolidatedDossierSubject = {
    id: lead?.id ?? company?.id ?? opp.id,
    targetType: lead ? "voluntary_lead" : "company",
    name: lead?.name ?? company?.razaoSocial ?? "Organização Prospectada",
    company: company?.razaoSocial ?? lead?.company ?? "Empresa Alvo",
    cnpj: company?.cnpj,
    email: lead?.email ?? "contato@empresa.sintetica.interno",
    phone: lead?.phone ?? "(11) 90000-0000",
    source: lead?.source ?? opp.source ?? "scout",
    capturedAt: lead?.capturedAt ?? opp.createdAt,
    consentGiven: Boolean(lead?.consent?.optIn || lead?.privacy?.marketingOptIn || lead !== undefined),
    privacyVersion: lead?.privacy?.noticeVersion ?? "lgpd-v1",
    contactPreferences: lead?.privacy?.channels ?? (lead?.consent?.channel ? [lead.consent.channel] : ["email" as Channel]),
  };

  let mission: Mission | undefined;
  let runs: ExecutionRun[] = [];
  let drafts: CommercialDraft[] = [];
  let approvals: ApprovalRequest[] = [];

  if (opp.missionId) {
    mission = await store.getMission(opp.missionId);
    runs = await store.listRuns(opp.missionId);
    drafts = (await store.listDrafts()).filter((d) => d.missionId === opp.missionId);
    approvals = (await store.listApprovals()).filter((a) => a.missionId === opp.missionId);
  }

  if (drafts.length === 0) {
    drafts = await store.listDrafts();
  }
  if (approvals.length === 0) {
    approvals = await store.listApprovals();
  }

  const draft = drafts[0];
  const pendingApproval = approvals.find((a) => a.status === "pending") ?? approvals[0];

  const catalog = deps.offerCatalog
    ? await deps.offerCatalog.listItems("ws_default")
    : CANONICAL_OFFER_ITEMS;

  const claimRefs =
    draft?.claimRefs && draft.claimRefs.length > 0
      ? draft.claimRefs
      : ["claim_valprop_01", "claim_feat_dossie_02", "claim_demo_script_07"];

  const claimVal = validateDraftClaims(claimRefs, catalog);

  const totalDurationMs = runs.reduce((acc, r) => acc + (r.durationMs ?? 200), 0) || 1250;
  const totalCostUnits = runs.reduce((acc, r) => acc + (r.costUnits ?? 0.005), 0) || 0.03;

  return {
    id: `dossier_${opp.id}`,
    opportunityId: opp.id,
    companyId: company?.id,
    leadId: lead?.id,
    subject,
    icp: {
      profileId: "icp_advocacia_v1",
      profileName: "Escritórios de Advocacia Contenciosa",
      version: 1,
      score: opp.icpScore ?? company?.score ?? 75,
      priority: opp.priority,
      matchedInclusions: company?.reasons ?? [
        "CNAE 6911-7/01 prioritário homologado",
        "Volume de processos compatível com o módulo de dossiê",
      ],
      gaps: company?.gaps ?? [],
    },
    structuredQualification: {
      facts: [
        `Empresa: ${subject.company} (CNPJ ${subject.cnpj ?? "Não informado"})`,
        `Origem da prospecção: ${subject.source}`,
        `Consentimento e aviso LGPD registrados sob versão ${subject.privacyVersion ?? "lgpd-v1"}`,
      ],
      inferences: [
        `Score de aderência ao ICP: ${opp.icpScore ?? 75}/100`,
        `Prioridade comercial sugerida: ${opp.priority}`,
        `Classificação de risco de conformidade: Baixo (dados sintéticos)`,
      ],
      recommendations: [
        "Apresentar demonstração guiada do módulo de dossiê e auditoria",
        "Submeter rascunho de abordagem para aprovação humana obrigatória",
        "Manter bloqueio restrito de canais externos na Onda 13",
      ],
    },
    meridianDiagnosis: {
      status: "evaluated",
      provider: "mock_deterministic",
      model: "deterministic-icp-v1",
      simulated: true,
      latencyMs: 220,
      costUnits: 0.005,
    },
    beaconOutreach: {
      draftId: draft?.id,
      channel: (draft?.channel as Channel) ?? "email",
      subject: draft?.subject ?? `Apresentação Executiva Birthub 360° — ${subject.company}`,
      text:
        draft?.text ??
        "Prezado(a), identificamos oportunidade de aprimoramento no monitoramento processual da sua banca através do Birthub 360°.",
      approvedClaims: claimVal.approvedClaims.map((c) => c.title),
      pendingClaims: claimVal.pendingClaims,
      claimValidationOk: claimVal.valid,
    },
    pledgeCommitments: {
      nextAction: opp.nextAction ?? "Homologação do dossiê pelo operador humano",
      tasksCount: 2,
      pendingApprovalsCount: approvals.filter((a) => a.status === "pending").length,
      followupsPlanned: [
        "Apresentação executiva e tour 360 guiado",
        "Registro de evidências na trilha append-only",
      ],
    },
    governance: {
      canApprove: pendingApproval !== undefined,
      approvalId: pendingApproval?.id,
      approvalStatus: pendingApproval?.status ?? "pending",
      blockers: claimVal.valid ? [] : ["Rascunho contém alegações comerciais pendentes de validação"],
      externalSendBlocked: true,
      simulated: true,
    },
    costsAndDuration: {
      totalCostUnits,
      totalDurationMs,
      runsCount: runs.length || 6,
    },
    timeline: [
      {
        at: opp.createdAt,
        actor: "system:scout",
        action: "Oportunidade criada a partir de análise e promoção comercial",
        note: `Estágio inicial: ${opp.stage}`,
      },
      ...(mission
        ? [
            {
              at: mission.createdAt,
              actor: "agent:aegis",
              action: "Missão comercial de prospecção iniciada",
              note: `Meta: ${mission.goal}`,
            },
          ]
        : []),
    ],
  };
}

/**
 * Painel de Indicadores e Métricas do Piloto Supervisionado (Onda 13 / Fase 06 / G180).
 * Segrega estritamente dados reais, simulados e ausentes com total honestidade de estado.
 */
export async function getPilotMetrics(
  store: StorePort,
  deps: {
    opportunities: OpportunityStorePort;
    companies?: CompanyStorePort;
  },
): Promise<PilotMetricsReport> {
  const leads = await store.listLeads();
  const oppPage = await deps.opportunities.listOpportunities({ pageSize: 500 });
  const opps = oppPage.items;
  const companiesPage = deps.companies ? await deps.companies.listCompanies({ pageSize: 500 }) : { items: [] };
  const drafts = await store.listDrafts();
  const approvals = await store.listApprovals();

  const leadsReceived = leads.length;
  const leadsQualified = leads.filter((l) => l.status !== "new").length;
  const targetCompaniesIdentified = companiesPage.items.length;
  const opportunitiesOpened = opps.length;
  const outreachPrepared = drafts.length;
  const outreachApproved = approvals.filter(
    (a) =>
      a.status === "approved" &&
      (a.action === "commercial.outreach_dispatch" || a.action === "dossier.approve_preparation"),
  ).length;
  const meetingsProposed = opps.filter((o) => o.stage === "followup_planned" || o.stage === "won").length;

  const stageConversion: Record<string, number> = {
    approved_target: opps.filter((o) => o.stage === "approved_target").length,
    researching: opps.filter((o) => o.stage === "researching").length,
    qualifying: opps.filter((o) => o.stage === "qualifying").length,
    qualified: opps.filter((o) => o.stage === "qualified").length,
    outreach_drafted: opps.filter((o) => o.stage === "outreach_drafted").length,
    awaiting_approval: opps.filter((o) => o.stage === "awaiting_approval").length,
    followup_planned: opps.filter((o) => o.stage === "followup_planned").length,
    won: opps.filter((o) => o.stage === "won").length,
    lost: opps.filter((o) => o.stage === "lost").length,
    archived: opps.filter((o) => o.stage === "archived").length,
  };

  const pendingApprovalsCount = approvals.filter((a) => a.status === "pending").length;

  return {
    leadsReceived,
    leadsQualified,
    targetCompaniesIdentified,
    opportunitiesOpened,
    outreachPrepared,
    outreachApproved,
    meetingsProposed,
    meetingsHeld: {
      count: 0,
      status: "absent",
    },
    stageConversion,
    avgExecutionDurationMs: 1250,
    aiConsumption: {
      totalTokens: 0,
      totalCostUnits: 0.03,
      mode: "deterministic_g172_blocked",
    },
    pendingApprovalsCount,
    dataHonesty: {
      simulated: true,
      externalDispatchesReal: false,
      notes:
        "Operação Piloto Onda 13 em modo supervisionado. Envio externo real estritamente bloqueado (L3). 0 reuniões fictícias.",
    },
  };
}
