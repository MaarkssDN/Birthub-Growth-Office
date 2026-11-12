import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import {
  CreateLeadInput,
  ApprovalDecisionInput,
  type LeadStatus,
} from "@bgo/contracts";
import { activeAgents, getPersona, layerCounts, listAgents, loadCatalog, evaluatePolicy } from "@bgo/agents";
import {
  Store,
  decideApproval,
  runDemoFlow,
  scoreLead,
  OFFER_CLAIMS,
  ICP_HYPOTHESIS,
} from "@bgo/commercial";
import { eventBus, recordAudit, snapshot as metricsSnapshot } from "@bgo/observability";
import { deriveVisualState } from "@bgo/ui";

export interface AppContext {
  store: Store;
}

export function buildApp(ctx: AppContext): FastifyInstance {
  const { store } = ctx;
  const app = Fastify({ logger: false });

  // ---- Dev auth (Onda 00): header x-bgo-user / x-bgo-role; default approver ----
  function actorOf(req: FastifyRequest): { id: string; role: string } {
    const id = (req.headers["x-bgo-user"] as string) ?? "user_approver";
    const role = (req.headers["x-bgo-role"] as string) ?? "approver";
    return { id, role };
  }

  app.get("/api/health", async () => ({
    ok: true,
    mode: "mock",
    simulated: true,
    workspace: store.workspace.slug,
    time: new Date().toISOString(),
  }));

  // ---- Catálogo 29 ----
  app.get("/api/catalog", async () => {
    const c = loadCatalog();
    return {
      meta: c.meta,
      layerCounts: layerCounts(),
      personas: c.personas,
      agents: c.agents,
    };
  });

  app.get("/api/catalog/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const persona = getPersona(id);
    const agent = listAgents().find((a) => a.agentId === id);
    if (!persona && !agent) return reply.code(404).send({ error: "persona não encontrada" });
    return { persona: persona ?? null, agent: agent ?? null };
  });

  // ---- Agents (estado visual derivado de runs) ----
  app.get("/api/agents", async () => {
    const runs = store.listRuns();
    const pendingApprovals = store.listApprovals("pending");
    return activeAgents().map((a) => {
      const latest = runs.filter((r) => r.agentId === a.agentId).at(-1);
      const awaiting = pendingApprovals.some((ap) => String(ap.requestedBy).includes(a.agentId));
      return {
        ...a,
        visual: deriveVisualState(latest?.status, { awaitingApproval: awaiting, simulated: true }),
        lastRunId: latest?.id ?? null,
        lastRunStatus: latest?.status ?? null,
      };
    });
  });

  // ---- Leads ----
  app.get("/api/leads", async () => store.listLeads());

  app.post("/api/leads", async (req, reply) => {
    const parsed = CreateLeadInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const lead = store.createLead(parsed.data, actorOf(req).id);
    const correlationId = randomUUID();
    eventBus.publish({
      eventType: "lead.created.v1",
      workspaceId: store.workspace.slug,
      correlationId,
      payload: { leadId: lead.id, source: lead.source, synthetic: lead.synthetic, status: lead.status },
    });
    const auditEv = recordAudit({
      actor: actorOf(req).id,
      action: "lead.create",
      entity: "Lead",
      entityId: lead.id,
      workspaceId: store.workspace.slug,
      correlationId,
      outcome: "allowed",
      payload: { synthetic: lead.synthetic, source: lead.source },
      publishEvent: false,
    });
    store.appendAudit(auditEv);
    return reply.code(201).send(lead);
  });

  app.get("/api/leads/:id", async (req, reply) => {
    const lead = store.getLead((req.params as { id: string }).id);
    if (!lead) return reply.code(404).send({ error: "lead não encontrado" });
    return lead;
  });

  app.post("/api/leads/:id/transition", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { to } = req.body as { to: LeadStatus };
    const before = store.getLead(id);
    if (!before) return reply.code(404).send({ error: "lead não encontrado" });
    const from = before.status;
    try {
      const lead = store.transitionLead(id, to, actorOf(req).id);
      const correlationId = randomUUID();
      eventBus.publish({
        eventType: "lead.status_changed.v1",
        workspaceId: store.workspace.slug,
        correlationId,
        payload: { leadId: lead.id, from, to: lead.status },
      });
      const auditEv = recordAudit({
        actor: actorOf(req).id,
        action: "lead.transition",
        entity: "Lead",
        entityId: lead.id,
        workspaceId: store.workspace.slug,
        correlationId,
        outcome: "allowed",
        payload: { from, to: lead.status },
        publishEvent: false,
      });
      store.appendAudit(auditEv);
      return lead;
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });

  app.post("/api/leads/:id/score", async (req, reply) => {
    const lead = store.getLead((req.params as { id: string }).id);
    if (!lead) return reply.code(404).send({ error: "lead não encontrado" });
    const decision = evaluatePolicy({ agentId: "meridian", tool: "lead.score", action: "apply_rubric", context: { hasApproval: false, channelAllowed: false, optInVerified: false, claimApproved: true, selfApproval: false, crossTenant: false } });
    if (!decision.allowed) return reply.code(403).send({ error: decision.reason });
    return scoreLead(lead);
  });

  // ---- Missões / Tasks / Runs ----
  app.get("/api/missions", async () =>
    store.listMissions().map((m) => ({
      ...m,
      tasks: store.listTasks(m.id),
      runs: store.listRuns(m.id),
      assignments: store.listAssignments(m.id),
    })),
  );

  app.get("/api/missions/:id", async (req, reply) => {
    const m = store.getMission((req.params as { id: string }).id);
    if (!m) return reply.code(404).send({ error: "missão não encontrada" });
    return {
      ...m,
      tasks: store.listTasks(m.id),
      runs: store.listRuns(m.id).map((r) => ({ ...r, steps: store.listSteps(r.id) })),
      assignments: store.listAssignments(m.id),
      approvals: store.listApprovals().filter((a) => a.missionId === m.id),
    };
  });

  // ---- Aprovações ----
  app.get("/api/approvals", async (req) => {
    const status = (req.query as { status?: string }).status as
      | "pending" | "approved" | "rejected" | "expired" | undefined;
    return store.listApprovals(status);
  });

  app.post("/api/approvals/:id/decision", async (req, reply) => {
    const actor = actorOf(req);
    if (actor.role !== "owner" && actor.role !== "approver") {
      return reply.code(403).send({ error: "role insuficiente para decidir aprovação" });
    }
    const parsed = ApprovalDecisionInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    if (parsed.data.decision === "rejected" && !parsed.data.reason) {
      return reply.code(400).send({ error: "rejeição exige motivo" });
    }
    try {
      const result = decideApproval(
        store,
        (req.params as { id: string }).id,
        parsed.data.decision,
        actor.id,
        parsed.data.reason,
      );
      return result;
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });

  // ---- Drafts ----
  app.get("/api/drafts", async () => store.listDrafts());

  // ---- Oferta / ICP ----
  app.get("/api/offer", async () => ({ version: "offer-v1", claims: OFFER_CLAIMS }));
  app.get("/api/icp", async () => ICP_HYPOTHESIS);

  // ---- Auditoria / Eventos / Métricas ----
  app.get("/api/audit", async (req) => {
    const q = req.query as { correlationId?: string; outcome?: "allowed" | "denied" | "info"; limit?: string };
    return store.listAudit({
      ...(q.correlationId !== undefined ? { correlationId: q.correlationId } : {}),
      ...(q.outcome !== undefined ? { outcome: q.outcome } : {}),
      limit: q.limit ? Number(q.limit) : 500,
    });
  });

  app.get("/api/events", async (req) => {
    const q = req.query as { correlationId?: string; eventType?: string; after?: string; limit?: string };
    return eventBus.list({
      ...(q.correlationId !== undefined ? { correlationId: q.correlationId } : {}),
      ...(q.eventType !== undefined ? { eventType: q.eventType as never } : {}),
      ...(q.after !== undefined ? { after: q.after } : {}),
      limit: q.limit ? Number(q.limit) : 500,
    });
  });

  app.get("/api/events/stream", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ mode: "mock", simulated: true })}\n\n`);
    const unsub = eventBus.subscribe((event) => {
      reply.raw.write(`id: ${event.eventId}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(`: hb ${new Date().toISOString()}\n\n`);
    }, 15000);
    req.raw.on("close", () => {
      unsub();
      clearInterval(heartbeat);
    });
    return reply;
  });

  app.get("/api/metrics", async () => metricsSnapshot());

  // ---- Policy probe (transparência: mostra decisão do backend) ----
  app.post("/api/policy/evaluate", async (req) => {
    return evaluatePolicy(req.body as Parameters<typeof evaluatePolicy>[0]);
  });

  // ---- Demo flow ----
  app.post("/api/demo/run", async (req) => {
    const input = req.body && typeof req.body === "object"
      ? CreateLeadInput.partial().parse(req.body)
      : undefined;
    const result = runDemoFlow(store, input as Parameters<typeof runDemoFlow>[1]);
    return { ...result, mode: "mock", simulated: true };
  });

  app.get("/api/demo/status", async () => {
    const pending = store.listApprovals("pending");
    const missions = store.listMissions();
    return {
      simulated: true,
      pendingApprovals: pending.length,
      missions: missions.length,
      leads: store.listLeads().length,
      drafts: store.listDrafts().length,
    };
  });

  return app;
}
