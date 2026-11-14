import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import { randomUUID } from "node:crypto";
import {
  CaptureFormInput,
  CreateLeadInput,
  LoginInput,
  ApprovalDecisionInput,
  type LeadStatus,
  type OpportunityPriority,
  type OpportunityStage,
  type Channel,
  type CommercialIcpProfile,
  type CommunicationDispatch,
  type CommercialOfferItem,
  type OfferCategory,
  type OfferItemStatus,
} from "@bgo/contracts";
import { activeAgents, getPersona, layerCounts, listAgents, loadCatalog, evaluatePolicy } from "@bgo/agents";
import {
  decideApproval,
  runDemoFlow,
  runOpportunityMission,
  scoreLead,
  captureLead,
  login as authLogin,
  logout as authLogout,
  resolveSession,
  sha256,
  OFFER_CLAIMS,
  ICP_HYPOTHESIS,
  approvedClaimIds,
  importCompaniesCsv,
  MemoryCompanyStore,
  MemoryCostStore,
  MemoryOpportunityStore,
  MemoryIcpStore,
  MemoryCommunicationSandboxStore,
  MemoryOfferCatalogStore,
  DEFAULT_COMMERCIAL_ICP_PROFILE,
  evaluateCompanyIcp,
  compareIcpEvaluation,
  dispatchSandboxMessage,
  validateDraftClaims,
  CANONICAL_OFFER_ITEMS,
  evaluateCommercialReadiness,
  buildConsolidatedDossier,
  onboardVoluntaryLead,
  getPilotMetrics,
  type IcpStorePort,
  type CommunicationSandboxStorePort,
  type OfferCatalogStorePort,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_TRANSITIONS,
  assertOpportunityTransition,
  checkPriorityRule,
  maxPriorityForScore,
  CostLedger,
  companiesToCsv,
  type CompanyReviewDecision,
  type CompanyReviewStatus,
  type CompanyStorePort,
  type CostStorePort,
  type OpportunityStorePort,
  type StorePort,
  OutboxPublisher,
  type OutboxEvent,
} from "@bgo/commercial";
import { eventBus, recordAudit, snapshot as metricsSnapshot, incr } from "@bgo/observability";
import { aiGateway, meridianDiagnose } from "@bgo/ai";
import { deriveVisualState } from "@bgo/ui";

export interface AppContext {
  store: StorePort;
  /** true somente quando BGO_DEV_AUTH=1 — habilita headers x-bgo-* legados. */
  devAuth?: boolean;
  /** modo de persistência para health/telemetria honesta */
  persistence?: "memory" | "postgres";
  /** Onda 10 — central Scout e ledger de custos (default: memória). */
  companies?: CompanyStorePort;
  costStore?: CostStorePort;
  costLimits?: { dailyUnits?: number; monthlyUnits?: number };
  /** Onda 11 — store de oportunidades comerciais (default: memória). */
  opportunities?: OpportunityStorePort;
  /** Onda 12 — ICP dinâmico, sandbox de comunicação e catálogo de oferta */
  icpStore?: IcpStorePort;
  sandboxStore?: CommunicationSandboxStorePort;
  offerCatalog?: OfferCatalogStorePort;
}

interface Actor {
  id: string;
  role: string;
  via: "session" | "dev-header";
}

/** Rate limiter em memória (por instância; suficiente p/ operação local). */
class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  hit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt < now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (b.count >= limit) return false;
    b.count += 1;
    return true;
  }
}

const limiter = new RateLimiter();

export function buildApp(ctx: AppContext): FastifyInstance {
  const { store } = ctx;
  const devAuth = ctx.devAuth === true;
  const companies = ctx.companies ?? new MemoryCompanyStore();
  const opportunities = ctx.opportunities ?? new MemoryOpportunityStore(companies, store.workspace.id);
  const icpStore = ctx.icpStore ?? new MemoryIcpStore();
  const sandboxStore = ctx.sandboxStore ?? new MemoryCommunicationSandboxStore();
  const offerCatalog = ctx.offerCatalog ?? new MemoryOfferCatalogStore();
  const costs = new CostLedger(ctx.costStore ?? new MemoryCostStore(), ctx.costLimits ?? {});
  // Ledger de custos alimentado pelo gateway — fire-and-forget, nunca quebra inferência.
  aiGateway.usageSink = (rec) => {
    void costs.record(rec).catch(() => undefined);
  };
  const app = Fastify({ logger: false });
  void app.register(cookie);

  async function audit(
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

  function publish(
    eventType: Parameters<typeof eventBus.publish>[0]["eventType"],
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
    // persistência do evento no outbox quando há store persistente
    const p = store as StorePort & { persistEvent?: (e: typeof event) => Promise<void> };
    if (typeof p.persistEvent === "function") {
      void p.persistEvent(event).catch(() => undefined);
    }
    return event;
  }

  // ---------- autenticação ----------
  function sessionToken(req: FastifyRequest): string | undefined {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    const cookie = req.headers.cookie;
    const m = cookie?.match(/(?:^|;\s*)bgo_session=([^;]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : undefined;
  }

  async function actorOf(req: FastifyRequest): Promise<Actor | null> {
    const token = sessionToken(req);
    if (token) {
      const resolved = await resolveSession(store, sha256(token));
      if (resolved) {
        return { id: `user:${resolved.user.id}`, role: resolved.user.role, via: "session" };
      }
    }
    if (devAuth) {
      const id = (req.headers["x-bgo-user"] as string) ?? "user_approver";
      const role = (req.headers["x-bgo-role"] as string) ?? "approver";
      return { id, role, via: "dev-header" };
    }
    return null;
  }

  async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<Actor | null> {
    const actor = await actorOf(req);
    if (!actor) {
      await reply.code(401).send({ error: "autenticação necessária" });
      return null;
    }
    return actor;
  }

  // ---------- rotas públicas ----------
  app.get("/api/health", async () => ({
    ok: true,
    mode: "mock",
    simulated: true,
    persistence: ctx.persistence ?? "memory",
    workspace: store.workspace.slug,
    time: new Date().toISOString(),
  }));

  app.post("/api/auth/login", async (req, reply) => {
    const ip = req.ip;
    if (!limiter.hit(`login:${ip}`, 5, 5 * 60 * 1000)) {
      return reply.code(429).send({ error: "muitas tentativas — aguarde alguns minutos" });
    }
    const parsed = LoginInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "e-mail ou senha inválidos" });
    const result = await authLogin(store, parsed.data.email, parsed.data.password);
    const correlationId = randomUUID();
    await audit(
      `login:${parsed.data.email}`,
      "auth.login",
      "AuthSession",
      result.ok ? "ok" : "denied",
      correlationId,
      result.ok ? "allowed" : "denied",
    );
    if (!result.ok || !result.sessionToken || !result.user) {
      return reply.code(401).send({ error: "credenciais inválidas" });
    }
    reply.setCookie("bgo_session", result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 3600,
    });
    return {
      token: result.sessionToken,
      user: result.user,
      expiresIn: 12 * 3600,
    };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = sessionToken(req);
    if (token) await authLogout(store, sha256(token));
    reply.clearCookie("bgo_session", { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const actor = await actorOf(req);
    if (!actor || actor.via !== "session") {
      const token = sessionToken(req);
      if (!token) return reply.code(401).send({ error: "sem sessão" });
      const resolved = await resolveSession(store, sha256(token));
      if (!resolved) return reply.code(401).send({ error: "sessão inválida" });
      return { user: { id: resolved.user.id, email: resolved.user.email, name: resolved.user.name, role: resolved.user.role }, expiresAt: resolved.session.expiresAt };
    }
    const userId = actor.id.replace("user:", "");
    const user = await store.getUser(userId);
    if (!user) return reply.code(401).send({ error: "usuário inexistente" });
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  // ---------- captação pública controlada ----------
  app.post("/api/capture", async (req, reply) => {
    const ip = req.ip;
    if (!limiter.hit(`capture:${ip}`, 10, 60 * 60 * 1000)) {
      return reply.code(429).send({ error: "limite de envios atingido — tente mais tarde" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    // honeypot: bots preenchem campo invisível
    if (typeof body.website === "string" && body.website.length > 0) {
      return reply.code(202).send({ ok: true, message: "Recebido." });
    }
    const parsed = CaptureFormInput.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "dados inválidos", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    }
    const correlationId = randomUUID();
    const result = await captureLead(store, parsed.data, "capture:public-form");
    await audit(
      "capture:public-form",
      result.duplicate ? "lead.capture.duplicate" : "lead.capture",
      "Lead",
      result.leadId,
      correlationId,
      "allowed",
      { source: parsed.data.source, synthetic: false, duplicate: result.duplicate },
    );
    publish("lead.created.v1", correlationId, {
      leadId: result.leadId,
      source: parsed.data.source,
      synthetic: false,
      status: result.status,
    });
    return reply.code(result.duplicate ? 200 : 201).send(result);
  });

  // ================= rotas autenticadas =================
  app.addHook("preHandler", async (req, reply) => {
    const url = req.url.split("?")[0] ?? "";
    const publicPaths = ["/api/health", "/api/auth/login", "/api/auth/logout", "/api/capture"];
    if (!url.startsWith("/api/") || publicPaths.includes(url)) return;
    const actor = await requireAuth(req, reply);
    if (!actor) return;
    (req as FastifyRequest & { actor?: Actor }).actor = actor;
  });

  function actor(req: FastifyRequest): Actor {
    return (req as FastifyRequest & { actor: Actor }).actor;
  }

  // ---- Catálogo 29 ----
  app.get("/api/catalog", async () => {
    const c = loadCatalog();
    return { meta: c.meta, layerCounts: layerCounts(), personas: c.personas, agents: c.agents };
  });

  app.get("/api/catalog/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const persona = getPersona(id);
    const agent = listAgents().find((a) => a.agentId === id);
    if (!persona && !agent) return reply.code(404).send({ error: "persona não encontrada" });
    return { persona: persona ?? null, agent: agent ?? null };
  });

  // ---- Agents ----
  app.get("/api/agents", async () => {
    const [runs, pendingApprovals] = await Promise.all([store.listRuns(), store.listApprovals("pending")]);
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
    const lead = await store.createLead(parsed.data, actor(req).id);
    const correlationId = randomUUID();
    publish("lead.created.v1", correlationId, {
      leadId: lead.id, source: lead.source, synthetic: lead.synthetic, status: lead.status,
    });
    await audit(actor(req).id, "lead.create", "Lead", lead.id, correlationId, "allowed",
      { synthetic: lead.synthetic, source: lead.source });
    return reply.code(201).send(lead);
  });

  app.get("/api/leads/:id", async (req, reply) => {
    const lead = await store.getLead((req.params as { id: string }).id);
    if (!lead) return reply.code(404).send({ error: "lead não encontrado" });
    return lead;
  });

  app.post("/api/leads/:id/transition", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { to } = req.body as { to: LeadStatus };
    const before = await store.getLead(id);
    if (!before) return reply.code(404).send({ error: "lead não encontrado" });
    const from = before.status;
    try {
      const lead = await store.transitionLead(id, to, actor(req).id);
      const correlationId = randomUUID();
      publish("lead.status_changed.v1", correlationId, { leadId: lead.id, from, to: lead.status });
      await audit(actor(req).id, "lead.transition", "Lead", lead.id, correlationId, "allowed", { from, to: lead.status });
      return lead;
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });

  app.post("/api/leads/:id/score", async (req, reply) => {
    const lead = await store.getLead((req.params as { id: string }).id);
    if (!lead) return reply.code(404).send({ error: "lead não encontrado" });
    const decision = evaluatePolicy({
      agentId: "meridian", tool: "lead.score", action: "apply_rubric",
      context: { hasApproval: false, channelAllowed: false, optInVerified: false, claimApproved: true, selfApproval: false, crossTenant: false },
    });
    if (!decision.allowed) return reply.code(403).send({ error: decision.reason });
    return scoreLead(lead);
  });

  // ---- Missões / Tasks / Runs ----
  app.get("/api/missions", async () => {
    const missions = await store.listMissions();
    return Promise.all(missions.map(async (m) => ({
      ...m,
      tasks: await store.listTasks(m.id),
      runs: await store.listRuns(m.id),
      assignments: await store.listAssignments(m.id),
    })));
  });

  app.get("/api/missions/:id", async (req, reply) => {
    const m = await store.getMission((req.params as { id: string }).id);
    if (!m) return reply.code(404).send({ error: "missão não encontrada" });
    const runs = await store.listRuns(m.id);
    return {
      ...m,
      tasks: await store.listTasks(m.id),
      runs: await Promise.all(runs.map(async (r) => ({ ...r, steps: await store.listSteps(r.id) }))),
      assignments: await store.listAssignments(m.id),
      approvals: (await store.listApprovals()).filter((a) => a.missionId === m.id),
    };
  });

  // ---- Central de Aprovações (Onda 11 / Fase 05) ----
  app.get("/api/approvals", async (req) => {
    const q = req.query as { status?: string; action?: string };
    const status = q.status as "pending" | "approved" | "rejected" | "expired" | undefined;
    const list = await store.listApprovals(status);
    if (q.action) return list.filter((a) => a.action === q.action);
    return list;
  });

  const SUPERVISED_ACTIONS = new Set([
    "company.promote_opportunity",
    "opportunity.sensitive_change",
    "draft.approve_review",
    "external.activity_request",
    "opportunity.priority_override",
    "budget.limit_override",
    // Onda 12: ICP Dinâmico, Comunicação e Oferta
    "icp.activate",
    "offer.approve",
    "communication.draft_review",
    // Onda 13: Piloto Supervisionado e Ficha Consolidada
    "dossier.approve_preparation",
    "commercial.outreach_dispatch",
  ]);

  app.post("/api/approvals/request", async (req, reply) => {
    const act = actor(req);
    if (act.role === "auditor") {
      return reply.code(403).send({ error: "role auditor não pode solicitar ações operacionais" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (!SUPERVISED_ACTIONS.has(action)) {
      return reply.code(400).send({
        error: `action inválida; permitidas: ${[...SUPERVISED_ACTIONS].join(", ")}`,
      });
    }
    const scope = typeof body.scope === "string" && body.scope.trim() ? body.scope.trim().slice(0, 200) : `custom:${action}`;
    const missionId = typeof body.missionId === "string" && body.missionId ? body.missionId : "mission_supervision";
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim().slice(0, 500)
        : `Solicitação supervisionada (${action}) na Central de Aprovações`;
    const preview = typeof body.preview === "object" && body.preview !== null ? (body.preview as Record<string, unknown>) : {};
    const correlationId = randomUUID();
    const approval = await store.createApproval({
      missionId,
      requestedBy: act.id,
      approverRole: "approver",
      action,
      scope,
      reason,
      correlationId,
      preview: { ...preview, correlationId, requestedAt: new Date().toISOString() },
    });
    await audit(act.id, "approval.requested", "ApprovalRequest", approval.id, correlationId, "allowed", {
      action,
      scope,
    });
    publish("approval.requested.v1", correlationId, {
      approvalId: approval.id,
      action,
      scope,
      requestedBy: act.id,
    }, { missionId, agentId: "pledge" });
    return reply.code(201).send(approval);
  });

  app.post("/api/approvals/:id/decision", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "approver") {
      return reply.code(403).send({ error: "role insuficiente para decidir aprovação" });
    }
    const parsed = ApprovalDecisionInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    if (parsed.data.decision === "rejected" && !parsed.data.reason) {
      return reply.code(400).send({ error: "rejeição exige motivo" });
    }
    try {
      const result = await decideApproval(
        store,
        (req.params as { id: string }).id,
        parsed.data.decision,
        act.id,
        parsed.data.reason,
        { opportunities, companies, icpStore, offerCatalog },
      );
      return result;
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });

  app.post("/api/approvals/:id/decide", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "approver") {
      return reply.code(403).send({ error: "role insuficiente para decidir aprovação" });
    }
    const parsed = ApprovalDecisionInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    if (parsed.data.decision === "rejected" && !parsed.data.reason) {
      return reply.code(400).send({ error: "rejeição exige motivo" });
    }
    try {
      const result = await decideApproval(
        store,
        (req.params as { id: string }).id,
        parsed.data.decision,
        act.id,
        parsed.data.reason,
        { opportunities, companies, icpStore, offerCatalog },
      );
      return result;
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });

  // ---- Drafts ----
  app.get("/api/drafts", async () => store.listDrafts());

  // ---- Oferta / ICP (Legado preservado) ----
  app.get("/api/offer", async () => ({ version: "offer-v1", claims: OFFER_CLAIMS }));
  app.get("/api/icp", async () => ICP_HYPOTHESIS);

  // =========================================================================
  // Onda 12 / Fase 02: ICP Comercial Dinâmico e Versionado
  // =========================================================================
  app.get("/api/icp/profiles", async (req) => {
    const q = req.query as { status?: string };
    const list = await icpStore.listProfiles(store.workspace.id, q.status);
    return { profiles: list, total: list.length };
  });

  app.get("/api/icp/active", async () => {
    const active = await icpStore.getActiveProfile(store.workspace.id);
    return active ?? DEFAULT_COMMERCIAL_ICP_PROFILE;
  });

  app.get("/api/icp/profiles/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const profile = await icpStore.getProfile(id);
    if (!profile) return reply.code(404).send({ error: "perfil ICP não encontrado" });
    const history = await icpStore.listHistory(id);
    return { profile, history };
  });

  app.post("/api/icp/profiles", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "operator") {
      return reply.code(403).send({ error: "role insuficiente para criar perfil de ICP" });
    }
    const body = (req.body ?? {}) as Partial<CommercialIcpProfile>;
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return reply.code(400).send({ error: "nome do perfil ICP é obrigatório" });
    }
    const correlationId = randomUUID();
    const id = `icp_${randomUUID()}`;
    const profile: CommercialIcpProfile = {
      id,
      workspaceId: store.workspace.id,
      name: body.name.trim(),
      version: 1,
      status: "draft",
      ...(body.description ? { description: body.description } : {}),
      targetSegments: Array.isArray(body.targetSegments) ? body.targetSegments : [],
      targetCnaes: Array.isArray(body.targetCnaes) ? body.targetCnaes : [],
      targetSizes: Array.isArray(body.targetSizes) ? body.targetSizes : ["EPP", "MEDIO", "GRANDE"],
      targetUfs: Array.isArray(body.targetUfs) ? body.targetUfs : ["SP", "RJ", "MG", "PR", "SC", "RS"],
      inclusions: Array.isArray(body.inclusions) ? body.inclusions : DEFAULT_COMMERCIAL_ICP_PROFILE.inclusions,
      exclusions: Array.isArray(body.exclusions) ? body.exclusions : DEFAULT_COMMERCIAL_ICP_PROFILE.exclusions,
      weights: body.weights ?? DEFAULT_COMMERCIAL_ICP_PROFILE.weights,
      changeReason: body.changeReason ?? "Criação de novo perfil de ICP comercial",
      createdBy: act.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = await icpStore.createProfile(profile);
    await audit(act.id, "icp.create", "CommercialIcpProfile", created.id, correlationId, "allowed", {
      name: created.name,
      version: created.version,
    });
    publish("icp.created.v1", correlationId, {
      profileId: created.id,
      name: created.name,
      version: created.version,
      createdBy: act.id,
    });
    return reply.code(201).send(created);
  });

  app.post("/api/icp/profiles/:id/version", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "operator") {
      return reply.code(403).send({ error: "role insuficiente para versionar perfil de ICP" });
    }
    const current = await icpStore.getProfile((req.params as { id: string }).id);
    if (!current) return reply.code(404).send({ error: "perfil ICP base não encontrado" });
    const body = (req.body ?? {}) as Partial<CommercialIcpProfile>;
    const changeReason = typeof body.changeReason === "string" && body.changeReason.trim()
      ? body.changeReason.trim()
      : "Atualização de critérios do Perfil de ICP";
    const correlationId = randomUUID();
    const newVersion = current.version + 1;
    const newProfile: CommercialIcpProfile = {
      ...current,
      id: `icp_${randomUUID()}`,
      version: newVersion,
      status: "draft",
      ...(body.description !== undefined ? { description: body.description } : {}),
      targetSegments: Array.isArray(body.targetSegments) ? body.targetSegments : current.targetSegments,
      targetCnaes: Array.isArray(body.targetCnaes) ? body.targetCnaes : current.targetCnaes,
      targetSizes: Array.isArray(body.targetSizes) ? body.targetSizes : current.targetSizes,
      targetUfs: Array.isArray(body.targetUfs) ? body.targetUfs : current.targetUfs,
      inclusions: Array.isArray(body.inclusions) ? body.inclusions : current.inclusions,
      exclusions: Array.isArray(body.exclusions) ? body.exclusions : current.exclusions,
      weights: body.weights ?? current.weights,
      changeReason,
      createdBy: act.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = await icpStore.createProfile(newProfile);
    await audit(act.id, "icp.version", "CommercialIcpProfile", created.id, correlationId, "allowed", {
      previousProfileId: current.id,
      version: newVersion,
      reason: changeReason,
    });
    publish("icp.created.v1", correlationId, {
      profileId: created.id,
      name: created.name,
      version: created.version,
      createdBy: act.id,
    });
    return reply.code(201).send(created);
  });

  app.post("/api/icp/profiles/:id/submit-approval", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "operator") {
      return reply.code(403).send({ error: "role insuficiente para submeter perfil para aprovação" });
    }
    const profile = await icpStore.getProfile((req.params as { id: string }).id);
    if (!profile) return reply.code(404).send({ error: "perfil ICP não encontrado" });
    const correlationId = randomUUID();
    const approval = await store.createApproval({
      missionId: "mission_icp_approval",
      requestedBy: act.id,
      approverRole: "approver",
      action: "icp.activate",
      scope: `icp:${profile.id}:v${profile.version}`,
      reason: `Ativação do Perfil ICP '${profile.name}' (versão ${profile.version}): ${profile.changeReason ?? "Novas regras comerciais"}`,
      correlationId,
      preview: {
        profileId: profile.id,
        name: profile.name,
        version: profile.version,
        weights: profile.weights,
        targetCnaes: profile.targetCnaes,
      },
    });
    await audit(act.id, "icp.submit_approval", "CommercialIcpProfile", profile.id, correlationId, "allowed", {
      approvalId: approval.id,
    });
    publish("icp.approval_requested.v1", correlationId, {
      profileId: profile.id,
      version: profile.version,
      requestedBy: act.id,
    });
    return reply.code(201).send({ profile, approval });
  });

  app.post("/api/icp/compare", async (req, reply) => {
    const body = (req.body ?? {}) as {
      profileAId?: string;
      profileBId?: string;
      companyId?: string;
      companyData?: {
        cnpj: string;
        razaoSocial: string;
        nomeFantasia?: string;
        cnae?: string;
        porte?: string;
        situacao?: string;
        municipio?: string;
        uf?: string;
      };
    };
    if (!body.profileAId || !body.profileBId) {
      return reply.code(400).send({ error: "profileAId e profileBId são obrigatórios" });
    }
    const [pA, pB] = await Promise.all([
      icpStore.getProfile(body.profileAId),
      icpStore.getProfile(body.profileBId),
    ]);
    if (!pA) return reply.code(404).send({ error: `perfil A (${body.profileAId}) não encontrado` });
    if (!pB) return reply.code(404).send({ error: `perfil B (${body.profileBId}) não encontrado` });

    let comp = body.companyData;
    if (!comp && body.companyId) {
      const stored = await companies.getCompany(body.companyId);
      if (stored) {
        comp = {
          cnpj: stored.cnpj,
          razaoSocial: stored.razaoSocial,
          ...(stored.nomeFantasia ? { nomeFantasia: stored.nomeFantasia } : {}),
          ...(stored.cnae ? { cnae: stored.cnae } : {}),
          ...(stored.porte ? { porte: stored.porte } : {}),
          ...(stored.situacao ? { situacao: stored.situacao } : {}),
          ...(stored.municipio ? { municipio: stored.municipio } : {}),
          ...(stored.uf ? { uf: stored.uf } : {}),
        };
      }
    }
    if (!comp) {
      comp = {
        cnpj: "11222333000181",
        razaoSocial: "Empresa de Demonstração LTDA",
        cnae: "62.01-5-01",
        porte: "EPP",
        situacao: "MATRIZ ATIVA",
        municipio: "São Paulo",
        uf: "SP",
      };
    }
    const comparison = compareIcpEvaluation(comp, pA, pB);
    return comparison;
  });

  // =========================================================================
  // Onda 12 / Fase 05: Central de Comunicação Supervisionada e Sandbox
  // =========================================================================
  app.get("/api/communication/drafts", async (req) => {
    const q = req.query as { opportunityId?: string; status?: string };
    let drafts = await store.listDrafts();
    if (q.opportunityId) drafts = drafts.filter((d) => d.opportunityId === q.opportunityId);
    if (q.status) drafts = drafts.filter((d) => d.status === q.status);
    return { drafts, total: drafts.length };
  });

  app.get("/api/communication/drafts/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const draft = await store.getDraft(id);
    if (!draft) return reply.code(404).send({ error: "rascunho de comunicação não encontrado" });
    return draft;
  });

  app.post("/api/communication/sandbox/dispatch", async (req, reply) => {
    const act = actor(req);
    const body = (req.body ?? {}) as {
      draftId?: string;
      opportunityId?: string;
      channel?: Channel;
      recipient?: string;
      subject?: string;
      content?: string;
      scenario?: "success" | "network_timeout" | "bounce" | "rate_limit" | "suppressed" | "unauthorized";
      correlationId?: string;
    };
    if (!body.recipient || !body.content) {
      return reply.code(400).send({ error: "recipient e content são obrigatórios para simulação" });
    }
    let isApproved = true;
    if (body.draftId) {
      const draft = await store.getDraft(body.draftId);
      if (draft && draft.status !== "approved") {
        isApproved = false;
      }
    }
    const correlationId = body.correlationId ?? randomUUID();
    const result = await dispatchSandboxMessage(sandboxStore, {
      workspaceId: store.workspace.id,
      draftId: body.draftId,
      opportunityId: body.opportunityId,
      channel: body.channel ?? "email",
      recipient: body.recipient,
      subject: body.subject,
      content: body.content,
      dispatchedBy: act.id,
      correlationId,
      scenario: body.scenario ?? "success",
      isDraftApproved: isApproved,
    });

    await audit(act.id, "communication.sandbox_dispatch", "CommunicationDispatch", result.dispatch.id, correlationId, "allowed", {
      status: result.dispatch.status,
      simulated: true,
      channel: result.dispatch.channel,
    });

    publish("communication.dispatched_simulated.v1", correlationId, {
      dispatchId: result.dispatch.id,
      channel: result.dispatch.channel,
      recipient: result.simulatedPayload.recipientMasked,
      status: result.dispatch.status,
      simulated: true,
      dispatchedBy: act.id,
    });

    return reply.code(result.duplicated ? 200 : 201).send(result);
  });

  app.get("/api/communication/dispatches", async (req) => {
    const q = req.query as { channel?: Channel; status?: string };
    const list = await sandboxStore.listDispatches(store.workspace.id, {
      ...(q.channel ? { channel: q.channel } : {}),
      ...(q.status ? { status: q.status as any } : {}),
    });
    return { dispatches: list, total: list.length };
  });

  // =========================================================================
  // Onda 12 / Fase 06: Governança da Oferta Comercial
  // =========================================================================
  app.get("/api/offer-catalog", async (req) => {
    const q = req.query as { category?: OfferCategory; status?: OfferItemStatus };
    const items = await offerCatalog.listItems(store.workspace.id, {
      ...(q.category ? { category: q.category } : {}),
      ...(q.status ? { status: q.status } : {}),
    });
    return { items, total: items.length };
  });

  app.post("/api/offer-catalog", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "operator") {
      return reply.code(403).send({ error: "role insuficiente para registrar item no catálogo de oferta" });
    }
    const body = (req.body ?? {}) as Partial<CommercialOfferItem>;
    if (!body.title || !body.content || !body.category) {
      return reply.code(400).send({ error: "category, title e content são obrigatórios" });
    }
    const correlationId = randomUUID();
    const item: CommercialOfferItem = {
      id: `offer_${randomUUID()}`,
      workspaceId: store.workspace.id,
      category: body.category as OfferCategory,
      title: body.title.trim(),
      content: body.content.trim(),
      ...(body.evidenceUrl ? { evidenceUrl: body.evidenceUrl } : {}),
      status: "pending_validation", // Sempre pendente de validação inicial
      version: body.version ?? "offer-v1",
      createdBy: act.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await offerCatalog.saveItem(item);
    await audit(act.id, "offer.create", "CommercialOfferItem", item.id, correlationId, "allowed", {
      category: item.category,
      title: item.title,
    });
    publish("offer_catalog.item_added.v1", correlationId, {
      itemId: item.id,
      category: item.category,
      title: item.title,
      createdBy: act.id,
    });
    return reply.code(201).send(item);
  });

  app.post("/api/offer-catalog/:id/review", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "approver") {
      return reply.code(403).send({ error: "role insuficiente para aprovar alegação comercial" });
    }
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as { decision?: "approved" | "rejected"; reason?: string };
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return reply.code(400).send({ error: "decision deve ser 'approved' ou 'rejected'" });
    }
    const correlationId = randomUUID();
    let updated: CommercialOfferItem | null;
    if (body.decision === "approved") {
      updated = await offerCatalog.approveItem(id, act.id);
      if (!updated) return reply.code(404).send({ error: "item não encontrado" });
      publish("offer_catalog.item_approved.v1", correlationId, {
        itemId: updated.id,
        category: updated.category,
        approvedBy: act.id,
      });
    } else {
      updated = await offerCatalog.rejectItem(id, act.id, body.reason ?? "Rejeitado na revisão");
      if (!updated) return reply.code(404).send({ error: "item não encontrado" });
    }
    await audit(act.id, "offer.review", "CommercialOfferItem", updated.id, correlationId, "allowed", {
      decision: body.decision,
    });
    return updated;
  });

  app.post("/api/offer-catalog/:id/submit-approval", async (req, reply) => {
    const act = actor(req);
    const id = (req.params as { id: string }).id;
    const item = await offerCatalog.getItem(id);
    if (!item) return reply.code(404).send({ error: "item de oferta não encontrado" });
    const correlationId = randomUUID();
    const approval = await store.createApproval({
      missionId: "mission_offer_approval",
      requestedBy: act.id,
      approverRole: "approver",
      action: "offer.approve",
      scope: `offer:${item.id}`,
      reason: `Aprovação de alegação comercial '${item.title}' (${item.category})`,
      correlationId,
      preview: {
        itemId: item.id,
        title: item.title,
        category: item.category,
      },
    });
    return reply.code(201).send({ item, approval });
  });

  app.post("/api/offer-catalog/validate", async (req, reply) => {
    const body = (req.body ?? {}) as { claimRefs?: string[] };
    if (!Array.isArray(body.claimRefs)) {
      return reply.code(400).send({ error: "claimRefs deve ser um array de referências/IDs" });
    }
    const items = await offerCatalog.listItems(store.workspace.id);
    const result = validateDraftClaims(body.claimRefs, items);
    return result;
  });

  app.post("/api/offer-catalog/validate-claims", async (req, reply) => {
    const body = (req.body ?? {}) as { claimRefs?: string[] };
    if (!Array.isArray(body.claimRefs)) {
      return reply.code(400).send({ error: "claimRefs deve ser um array de referências/IDs" });
    }
    const items = await offerCatalog.listItems(store.workspace.id);
    const result = validateDraftClaims(body.claimRefs, items);
    return result;
  });

  // =========================================================================
  // Onda 13: Prontidão Comercial, Piloto Supervisionado e Ficha Consolidada
  // =========================================================================

  app.get("/api/commercial/readiness", async (req) => {
    const items = await offerCatalog.listItems(store.workspace.id);
    const report = evaluateCommercialReadiness(items, store.workspace.id);
    return report;
  });

  app.get("/api/commercial/dossier/:opportunityId", async (req, reply) => {
    const oppId = (req.params as { opportunityId: string }).opportunityId;
    try {
      const dossier = await buildConsolidatedDossier(store, oppId, {
        opportunities,
        companies,
        icpStore,
        offerCatalog,
      });
      return dossier;
    } catch (e) {
      return reply.code(404).send({ error: (e as Error).message });
    }
  });

  app.post("/api/leads/:id/onboard-opportunity", async (req, reply) => {
    const act = actor(req);
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as {
      runMissionNow?: boolean;
      icpProfileId?: string;
    };
    try {
      const result = await onboardVoluntaryLead(
        store,
        id,
        act.id,
        {
          opportunities,
          companies,
          icpStore,
          offerCatalog,
        },
        {
          ...(body.runMissionNow ? { runMissionNow: true } : {}),
          ...(typeof body.icpProfileId === "string" ? { icpProfileId: body.icpProfileId } : {}),
        },
      );
      return reply.code(201).send(result);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.get("/api/metrics/pilot", async () => {
    const metrics = await getPilotMetrics(store, {
      opportunities,
      companies,
    });
    return metrics;
  });

  app.post("/api/opportunities/:id/dossier/review", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "approver") {
      return reply.code(403).send({ error: "role insuficiente para homologar preparação de dossiê" });
    }
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as { decision?: "approved" | "rejected"; reason?: string };
    if (body.decision !== "approved" && body.decision !== "rejected") {
      return reply.code(400).send({ error: "decision deve ser 'approved' ou 'rejected'" });
    }
    const opp = await opportunities.getOpportunity(id);
    if (!opp) return reply.code(404).send({ error: "oportunidade não encontrada" });

    // Encontra a aprovação correspondente da oportunidade ou missão
    const pendingApprovals = await store.listApprovals("pending");
    let approval = pendingApprovals.find(
      (a) =>
        (a.preview as Record<string, unknown>)?.opportunityId === id ||
        (opp.missionId && a.missionId === opp.missionId),
    );

    const correlationId = randomUUID();
    if (!approval) {
      approval = await store.createApproval({
        missionId: opp.missionId ?? "mission_dossier_review",
        requestedBy: "agent:pledge",
        approverRole: "approver",
        action: "dossier.approve_preparation",
        scope: `opportunity:${opp.id}`,
        reason: `Homologação humana de preparação de dossiê da oportunidade ${opp.id}`,
        correlationId,
        preview: {
          opportunityId: opp.id,
          stage: opp.stage,
        },
      });
    }

    const decisionResult = await decideApproval(
      store,
      approval.id,
      body.decision,
      act.id,
      body.reason ?? (body.decision === "approved" ? "Preparação de dossiê comercial homologada" : "Preparação rejeitada"),
      { opportunities, companies, icpStore, offerCatalog },
    );

    return {
      success: true,
      decision: body.decision,
      approval: decisionResult.approval,
      opportunity: decisionResult.opportunity ?? opp,
      externalSendBlocked: true,
      note: "Material comercial homologado para preparação humana. Disparo externo permanece bloqueado pela política de governança.",
    };
  });

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
    const persisted = store as StorePort & { listPersistedEvents?: (f?: { correlationId?: string; limit?: number }) => Promise<unknown[]> };
    if (typeof persisted.listPersistedEvents === "function") {
      return persisted.listPersistedEvents({
        ...(q.correlationId !== undefined ? { correlationId: q.correlationId } : {}),
        limit: q.limit ? Number(q.limit) : 500,
      });
    }
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
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ mode: "mock", simulated: true, persistence: ctx.persistence ?? "memory" })}\n\n`);
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

  // ---- Status dos provedores de IA (transparência: sempre declara modo) ----
  app.get("/api/ai/status", async () => ({ ...aiGateway.status(), note: "modo simulated = respostas mock determinísticas, nenhum modelo real consultado" }));

  // Diagnóstico comercial do Meridian (Onda 03) — autenticado, auditado,
  // nunca dispara ação externa; saída passa pela guarda anti-promoções.
  app.post("/api/ai/meridian-diagnose", async (req, reply) => {
    const actor = await requireAuth(req, reply);
    if (!actor) return;
    if (!limiter.hit(`ai-diagnose:${actor.id}`, 10, 60 * 60 * 1000)) {
      return reply.code(429).send({ error: "limite de diagnósticos por hora atingido" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const correlationId = randomUUID();
    const leadId = typeof body.leadId === "string" ? body.leadId : undefined;
    let leadData: Record<string, unknown> = { ...(body.lead as Record<string, unknown> | undefined ?? {}) };
    if (leadId) {
      const lead = await store.getLead(leadId);
      if (!lead) return reply.code(404).send({ error: "lead não encontrado" });
      leadData = { id: lead.id, name: lead.name, company: lead.company, interest: lead.interest, source: lead.source, status: lead.status };
    }
    // Onda 10/G96 — orçamento diário/mensal bloqueia antes da inferência
    const budget = await costs.assertBudget();
    if (!budget.allowed) {
      await audit(actor.id, "ai.budget_blocked", "AiUsage", "budget", correlationId, "denied", { reason: budget.reason });
      return reply.code(429).send({ error: `orçamento de IA excedido: ${budget.reason}` });
    }
    const result = await meridianDiagnose(aiGateway, {
      ...leadData,
      ...(typeof body.missionId === "string" ? { missionId: body.missionId } : {}),
      correlationId,
      ...(typeof body.icp === "object" && body.icp !== null ? { icp: body.icp } : { icp: ICP_HYPOTHESIS }),
      approvedClaims: approvedClaimIds(),
    });
    await audit(actor.id, "ai.meridian_diagnose", "Lead", leadId ?? "adhoc", correlationId, result.ok ? "allowed" : "denied", {
      simulated: result.simulated, provider: result.provider, model: result.model,
      promptVersion: result.promptVersion, rejectedReason: result.rejectedReason ?? null,
    });
    return { ...result, correlationId, simulated: true };
  });

  // ---- Scout: central de prospecção (Onda 10 + Onda 11) ----
  app.post("/api/scout/import", async (req, reply) => {
    const act = await requireAuth(req, reply);
    if (!act) return;
    if (act.role === "auditor") {
      return reply.code(403).send({ error: "role auditor não pode importar empresas" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (csv.length > 2_000_000) return reply.code(413).send({ error: "CSV excede 2MB" });
    const fonte = typeof body.fonte === "string" && body.fonte.trim() ? body.fonte.trim().slice(0, 120) : "csv-upload";
    const filename = typeof body.filename === "string" ? body.filename.slice(0, 200) : undefined;
    const missionId = typeof body.missionId === "string" ? body.missionId : undefined;
    const correlationId = randomUUID();
    const result = importCompaniesCsv(csv, { fonte });
    // Persistência: lote + empresas deduplicadas por CNPJ (transação por empresa).
    let batchId: string | undefined;
    let persisted = { inserted: 0, duplicates: 0 };
    try {
      const batch = await companies.createImportBatch({
        fonte,
        ...(filename !== undefined ? { filename } : {}),
        ...(missionId !== undefined ? { missionId } : {}),
        correlationId,
        totalRows: result.imported + result.duplicates + result.rejected.length,
        imported: result.imported,
        duplicates: result.duplicates,
        rejected: result.rejected.length,
        rejectedDetail: result.rejected.slice(0, 200),
        importedBy: act.id,
      });
      batchId = batch.id;
      persisted = await companies.upsertCompanies(batch.id, result.dossiers, missionId);
    } catch (e) {
      await audit(act.id, "scout.import.persist_failed", "CompanyImport", fonte, correlationId, "denied", {
        error: (e as Error).message,
      });
      return reply.code(500).send({ error: "falha ao persistir importação — nenhuma empresa gravada parcialmente" });
    }
    await audit(act.id, "scout.import", "CompanyImport", batchId ?? fonte, correlationId,
      result.imported > 0 || result.rejected.length === 0 ? "allowed" : "denied",
      { imported: result.imported, duplicates: result.duplicates, rejected: result.rejected.length, persistedInserted: persisted.inserted });
    publish("scout.import.completed.v1", correlationId, {
      batchId, imported: result.imported, duplicates: result.duplicates, rejected: result.rejected.length,
    }, { agentId: "scout" });
    return {
      ...result,
      batchId,
      persisted,
      correlationId,
      simulated: false,
      note: "dossiês = aderência heurística à ICP, não evidência de intenção de compra; empresa importada não é lead até revisão humana",
    };
  });

  app.get("/api/scout/imports", async () => companies.listImportBatches());

  app.get("/api/scout/companies", async (req) => {
    const q = req.query as Record<string, string>;
    const num = (v?: string) => (v !== undefined && v !== "" ? Number(v) : undefined);
    const page = await companies.listCompanies({
      ...(num(q.minScore) !== undefined ? { minScore: num(q.minScore)! } : {}),
      ...(num(q.maxScore) !== undefined ? { maxScore: num(q.maxScore)! } : {}),
      ...(q.uf ? { uf: q.uf } : {}),
      ...(q.municipio ? { municipio: q.municipio } : {}),
      ...(q.cnae ? { cnae: q.cnae } : {}),
      ...(q.porte ? { porte: q.porte } : {}),
      ...(q.situacao ? { situacao: q.situacao } : {}),
      ...(q.reviewStatus ? { reviewStatus: q.reviewStatus as CompanyReviewStatus } : {}),
      ...(q.q ? { q: q.q } : {}),
      ...(num(q.page) !== undefined ? { page: num(q.page)! } : {}),
      ...(num(q.pageSize) !== undefined ? { pageSize: num(q.pageSize)! } : {}),
    });
    const items = await Promise.all(
      page.items.map(async (c) => {
        const opp = await opportunities.getOpportunityByCompany(c.id);
        return {
          ...c,
          ...(opp ? { opportunityId: opp.id, opportunityStage: opp.stage } : {}),
        };
      }),
    );
    return { ...page, items };
  });

  app.get("/api/scout/companies/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const company = await companies.getCompany(id);
    if (!company) return reply.code(404).send({ error: "empresa não encontrada" });
    const [history, opportunity] = await Promise.all([
      companies.companyHistory(id),
      opportunities.getOpportunityByCompany(id),
    ]);
    return { company, history, opportunity: opportunity ?? null };
  });

  app.post("/api/scout/companies/:id/review", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "operator" && act.role !== "approver") {
      return reply.code(403).send({ error: "role insuficiente para revisar empresa" });
    }
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const decision = body.decision;
    if (decision !== "approved" && decision !== "rejected" && decision !== "archived") {
      return reply.code(400).send({ error: "decision deve ser approved|rejected|archived" });
    }
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined;
    const correlationId = randomUUID();
    try {
      const company = await companies.reviewCompany(id, decision as CompanyReviewDecision, act.id, reason);
      await audit(act.id, `scout.company.${decision}`, "Company", id, correlationId, "allowed", {
        cnpj: company.cnpj, score: company.score, ...(reason !== undefined ? { reason } : {}),
      });
      publish("scout.company.reviewed.v1", correlationId, {
        companyId: id, cnpj: company.cnpj, decision, score: company.score,
      }, { agentId: "scout" });
      return company;
    } catch (e) {
      return reply.code(404).send({ error: (e as Error).message });
    }
  });

  // ---- Onda 11 / Fase 02: Criar oportunidade comercial a partir da Central Scout ----
  async function handlePromoteCompanyToOpportunity(
    companyId: string,
    body: Record<string, unknown>,
    act: Actor,
    reply: FastifyReply,
  ) {
    const correlationId = randomUUID();
    if (act.role !== "owner" && act.role !== "operator" && act.role !== "approver") {
      await audit(act.id, "opportunity.create.denied", "Company", companyId, correlationId, "denied", {
        reason: "role insuficiente",
        role: act.role,
      });
      return reply.code(403).send({ error: "role insuficiente para criar oportunidade comercial" });
    }

    const justification =
      typeof body.justification === "string" && body.justification.trim()
        ? body.justification.trim().slice(0, 500)
        : "Promoção autorizada da Central Scout para o Pipeline Comercial";
    const requireApproval = body.requireApproval === true;

    if (requireApproval) {
      const company = await companies.getCompany(companyId);
      if (!company) return reply.code(404).send({ error: "empresa não encontrada" });
      if (company.reviewStatus !== "approved") {
        return reply.code(409).send({
          error: `empresa precisa estar aprovada na Central Scout antes de criar oportunidade comercial (status atual: ${company.reviewStatus})`,
        });
      }
      const existing = await opportunities.getOpportunityByCompany(companyId);
      if (existing) {
        return reply.code(200).send({ opportunity: existing, created: false, duplicate: true, correlationId });
      }
      const approval = await store.createApproval({
        missionId: company.missionId ?? "mission_scout_promote",
        requestedBy: act.id,
        approverRole: "approver",
        action: "company.promote_opportunity",
        scope: `company:${company.id}`,
        reason: justification,
        correlationId,
        preview: {
          companyId: company.id,
          cnpj: company.cnpj,
          razaoSocial: company.razaoSocial,
          score: company.score,
          justification,
          correlationId,
        },
      });
      await audit(act.id, "approval.requested", "ApprovalRequest", approval.id, correlationId, "allowed", {
        action: "company.promote_opportunity",
        companyId: company.id,
      });
      publish(
        "approval.requested.v1",
        correlationId,
        {
          approvalId: approval.id,
          action: "company.promote_opportunity",
          requestedBy: act.id,
          scope: approval.scope,
          companyId: company.id,
        },
        { agentId: "pledge" },
      );
      return reply.code(202).send({ queuedForApproval: true, approval, correlationId });
    }

    try {
      const result = await opportunities.promoteCompany({
        companyId,
        approvedBy: act.id,
        justification,
        correlationId,
        ownerId: act.id,
      });
      if (result.created) {
        await audit(act.id, "opportunity.create", "Opportunity", result.opportunity.id, correlationId, "allowed", {
          companyId,
          stage: result.opportunity.stage,
          icpScore: result.opportunity.icpScore,
          priority: result.opportunity.priority,
          source: result.opportunity.source,
          justification,
        });
        publish(
          "opportunity.created.v1",
          correlationId,
          {
            opportunityId: result.opportunity.id,
            companyId,
            stage: result.opportunity.stage,
            icpScore: result.opportunity.icpScore,
            priority: result.opportunity.priority,
            approvedBy: act.id,
          },
          { agentId: "scout" },
        );
        return reply.code(201).send({ ...result, correlationId });
      }
      await audit(act.id, "opportunity.create.duplicate", "Opportunity", result.opportunity.id, correlationId, "info", {
        companyId,
        opportunityId: result.opportunity.id,
      });
      return reply.code(200).send({ ...result, correlationId });
    } catch (e) {
      const msg = (e as Error).message;
      await audit(act.id, "opportunity.create.denied", "Company", companyId, correlationId, "denied", {
        error: msg,
      });
      if (msg.includes("não encontrada")) {
        return reply.code(404).send({ error: msg });
      }
      return reply.code(409).send({ error: msg });
    }
  }

  app.post("/api/scout/companies/:id/opportunity", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = (req.body ?? {}) as Record<string, unknown>;
    return handlePromoteCompanyToOpportunity(id, body, actor(req), reply);
  });

  app.post("/api/opportunities", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const companyId = typeof body.companyId === "string" ? body.companyId : "";
    if (!companyId) return reply.code(400).send({ error: "companyId obrigatório" });
    return handlePromoteCompanyToOpportunity(companyId, body, actor(req), reply);
  });

  // ---- Onda 11 / Fase 04: Pipeline Comercial Visual ----
  app.get("/api/opportunities", async (req) => {
    const q = req.query as Record<string, string>;
    const num = (v?: string) => (v !== undefined && v !== "" ? Number(v) : undefined);
    const [page, pendingApprovals, approvedCompaniesPage] = await Promise.all([
      opportunities.listOpportunities({
        ...(q.stage ? { stage: q.stage as OpportunityStage } : {}),
        ...(q.currentAgentId ? { currentAgentId: q.currentAgentId } : {}),
        ...(q.priority ? { priority: q.priority as OpportunityPriority } : {}),
        ...(q.companyId ? { companyId: q.companyId } : {}),
        ...(num(q.minScore) !== undefined ? { minScore: num(q.minScore)! } : {}),
        ...(num(q.maxScore) !== undefined ? { maxScore: num(q.maxScore)! } : {}),
        ...(q.q ? { q: q.q } : {}),
        ...(num(q.page) !== undefined ? { page: num(q.page)! } : {}),
        ...(num(q.pageSize) !== undefined ? { pageSize: num(q.pageSize)! } : {}),
      }),
      store.listApprovals("pending"),
      companies.listCompanies({ reviewStatus: "approved", pageSize: 200 }),
    ]);

    const items = page.items.map((o) => {
      const pendingApprovalsCount = pendingApprovals.filter(
        (a) =>
          (o.missionId && a.missionId === o.missionId) ||
          a.scope.includes(o.id) ||
          (a.preview && (a.preview as Record<string, unknown>).opportunityId === o.id),
      ).length;
      return { ...o, pendingApprovalsCount };
    });

    const approvedWithOpp = await Promise.all(
      approvedCompaniesPage.items.map(async (c) => ({
        company: c,
        opp: await opportunities.getOpportunityByCompany(c.id),
      })),
    );
    const approvedCompaniesReady = approvedWithOpp.filter((x) => !x.opp).map((x) => x.company);

    return {
      ...page,
      items,
      approvedCompaniesReady,
      stageLabels: OPPORTUNITY_STAGE_LABELS,
      validTransitions: OPPORTUNITY_TRANSITIONS,
    };
  });

  app.get("/api/opportunities/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const opp = await opportunities.getOpportunity(id);
    if (!opp) return reply.code(404).send({ error: "oportunidade não encontrada" });
    const [company, history, companyHistory, mission, allDrafts, allApprovals] = await Promise.all([
      opp.companyId ? companies.getCompany(opp.companyId) : Promise.resolve(undefined),
      opportunities.opportunityHistory(opp.id),
      opp.companyId ? companies.companyHistory(opp.companyId) : Promise.resolve([]),
      opp.missionId ? store.getMission(opp.missionId) : Promise.resolve(undefined),
      store.listDrafts(),
      store.listApprovals(),
    ]);
    const tasks = opp.missionId ? await store.listTasks(opp.missionId) : [];
    const rawRuns = opp.missionId ? await store.listRuns(opp.missionId) : [];
    const runs = await Promise.all(rawRuns.map(async (r) => ({ ...r, steps: await store.listSteps(r.id) })));
    const drafts = allDrafts.filter(
      (d) => d.opportunityId === opp.id || (opp.missionId !== undefined && d.missionId === opp.missionId),
    );
    const approvals = allApprovals.filter(
      (a) =>
        (opp.missionId !== undefined && a.missionId === opp.missionId) ||
        a.scope.includes(opp.id) ||
        (opp.companyId ? a.scope.includes(opp.companyId) : false) ||
        (a.preview && (a.preview as Record<string, unknown>).opportunityId === opp.id),
    );
    return {
      opportunity: opp,
      company: company ?? null,
      history,
      companyHistory,
      mission: mission ?? null,
      tasks,
      runs,
      drafts,
      approvals,
      validTransitions: OPPORTUNITY_TRANSITIONS[opp.stage] ?? [],
      maxDirectPriority: maxPriorityForScore(opp.icpScore),
      stageLabels: OPPORTUNITY_STAGE_LABELS,
    };
  });

  app.post("/api/opportunities/:id/transition", async (req, reply) => {
    const act = actor(req);
    const id = (req.params as { id: string }).id;
    const correlationId = randomUUID();
    if (act.role !== "owner" && act.role !== "operator" && act.role !== "approver") {
      await audit(act.id, "opportunity.transition.denied", "Opportunity", id, correlationId, "denied", {
        reason: "role insuficiente",
        role: act.role,
      });
      return reply.code(403).send({ error: "role insuficiente para movimentar oportunidade no pipeline" });
    }
    const opp = await opportunities.getOpportunity(id);
    if (!opp) return reply.code(404).send({ error: "oportunidade não encontrada" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const to = body.to as OpportunityStage | undefined;
    if (!to || !(to in OPPORTUNITY_TRANSITIONS)) {
      return reply.code(400).send({ error: "estágio de destino inválido" });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;
    const currentAgentId =
      body.currentAgentId === null
        ? null
        : typeof body.currentAgentId === "string"
          ? body.currentAgentId
          : undefined;
    const nextAction =
      body.nextAction === null
        ? null
        : typeof body.nextAction === "string"
          ? body.nextAction.slice(0, 500)
          : undefined;

    try {
      assertOpportunityTransition(opp.stage, to, reason);
    } catch (e) {
      await audit(act.id, "opportunity.transition.denied", "Opportunity", id, correlationId, "denied", {
        fromStage: opp.stage,
        toStage: to,
        error: (e as Error).message,
      });
      return reply.code(409).send({ error: (e as Error).message });
    }

    if (body.requireApproval === true) {
      const approval = await store.createApproval({
        missionId: opp.missionId ?? "mission_pipeline",
        requestedBy: act.id,
        approverRole: "approver",
        action: "opportunity.sensitive_change",
        scope: `opportunity:${opp.id}:stage:${to}`,
        reason: reason ?? `Alteração comercial sensível de estágio: ${opp.stage} → ${to}`,
        correlationId,
        preview: {
          opportunityId: opp.id,
          companyId: opp.companyId,
          fromStage: opp.stage,
          toStage: to,
          ...(reason !== undefined ? { reason } : {}),
          ...(currentAgentId !== undefined ? { currentAgentId } : {}),
          ...(nextAction !== undefined ? { nextAction } : {}),
          correlationId,
        },
      });
      await audit(act.id, "approval.requested", "ApprovalRequest", approval.id, correlationId, "allowed", {
        action: "opportunity.sensitive_change",
        opportunityId: opp.id,
        toStage: to,
      });
      publish(
        "approval.requested.v1",
        correlationId,
        {
          approvalId: approval.id,
          action: "opportunity.sensitive_change",
          requestedBy: act.id,
          scope: approval.scope,
          opportunityId: opp.id,
          toStage: to,
        },
        { ...(opp.missionId ? { missionId: opp.missionId } : {}), agentId: "pledge" },
      );
      return reply.code(202).send({ queuedForApproval: true, approval, correlationId });
    }

    const fromStage = opp.stage;
    const updated = await opportunities.transitionOpportunity(id, to, act.id, {
      ...(reason !== undefined ? { reason } : {}),
      ...(currentAgentId !== undefined ? { currentAgentId } : {}),
      ...(nextAction !== undefined ? { nextAction } : {}),
      correlationId,
    });
    await audit(act.id, "opportunity.transition", "Opportunity", id, correlationId, "allowed", {
      fromStage,
      toStage: to,
      ...(reason !== undefined ? { reason } : {}),
    });
    publish(
      "opportunity.stage_changed.v1",
      correlationId,
      {
        opportunityId: id,
        companyId: opp.companyId,
        fromStage,
        toStage: to,
        actor: act.id,
        ...(reason !== undefined ? { reason } : {}),
      },
      { ...(opp.missionId ? { missionId: opp.missionId } : {}), ...(updated.currentAgentId ? { agentId: updated.currentAgentId } : {}) },
    );
    return updated;
  });

  app.post("/api/opportunities/:id/priority", async (req, reply) => {
    const act = actor(req);
    const id = (req.params as { id: string }).id;
    const correlationId = randomUUID();
    if (act.role !== "owner" && act.role !== "operator" && act.role !== "approver") {
      await audit(act.id, "opportunity.priority.denied", "Opportunity", id, correlationId, "denied", {
        reason: "role insuficiente",
      });
      return reply.code(403).send({ error: "role insuficiente para alterar prioridade comercial" });
    }
    const opp = await opportunities.getOpportunity(id);
    if (!opp) return reply.code(404).send({ error: "oportunidade não encontrada" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const priority = body.priority as OpportunityPriority | undefined;
    if (priority !== "low" && priority !== "normal" && priority !== "high" && priority !== "critical") {
      return reply.code(400).send({ error: "priority deve ser low|normal|high|critical" });
    }
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;
    const rule = checkPriorityRule(opp.icpScore, priority);

    if (!rule.allowedDirect) {
      const approval = await store.createApproval({
        missionId: opp.missionId ?? "mission_pipeline_priority",
        requestedBy: act.id,
        approverRole: "approver",
        action: "opportunity.priority_override",
        scope: `opportunity:${opp.id}:priority:${priority}`,
        reason: reason ?? rule.reason ?? `Exceção de prioridade comercial: ${opp.priority} → ${priority}`,
        correlationId,
        preview: {
          opportunityId: opp.id,
          companyId: opp.companyId,
          fromPriority: opp.priority,
          priority,
          icpScore: opp.icpScore,
          maxAllowed: rule.maxAllowed,
          reason: reason ?? rule.reason,
          correlationId,
        },
      });
      await audit(act.id, "approval.requested", "ApprovalRequest", approval.id, correlationId, "allowed", {
        action: "opportunity.priority_override",
        opportunityId: opp.id,
        fromPriority: opp.priority,
        requestedPriority: priority,
        maxAllowed: rule.maxAllowed,
      });
      publish(
        "approval.requested.v1",
        correlationId,
        {
          approvalId: approval.id,
          action: "opportunity.priority_override",
          requestedBy: act.id,
          scope: approval.scope,
          opportunityId: opp.id,
          requestedPriority: priority,
        },
        { ...(opp.missionId ? { missionId: opp.missionId } : {}), agentId: "pledge" },
      );
      return reply.code(202).send({ queuedForApproval: true, approval, rule, correlationId });
    }

    const fromPriority = opp.priority;
    const updated = await opportunities.updateOpportunity(
      id,
      { priority },
      act.id,
      {
        action: "priority_changed",
        reason: reason ?? `Prioridade ajustada dentro do teto determinístico (${rule.maxAllowed})`,
        details: { fromPriority, toPriority: priority, icpScore: opp.icpScore },
        correlationId,
      },
    );
    await audit(act.id, "opportunity.priority_changed", "Opportunity", id, correlationId, "allowed", {
      fromPriority,
      toPriority: priority,
    });
    publish(
      "opportunity.priority_changed.v1",
      correlationId,
      { opportunityId: id, fromPriority, toPriority: priority, actor: act.id },
      { ...(opp.missionId ? { missionId: opp.missionId } : {}), agentId: "meridian" },
    );
    return { opportunity: updated, queuedForApproval: false, rule, correlationId };
  });

  // ---- Onda 11 / Fase 03: Orquestração dos 6 Agentes na Oportunidade ----
  app.post("/api/opportunities/:id/mission", async (req, reply) => {
    const act = actor(req);
    const id = (req.params as { id: string }).id;
    const correlationId = randomUUID();
    if (act.role !== "owner" && act.role !== "operator" && act.role !== "approver") {
      await audit(act.id, "opportunity.mission.denied", "Opportunity", id, correlationId, "denied", {
        reason: "role insuficiente",
      });
      return reply.code(403).send({ error: "role insuficiente para executar missão comercial" });
    }
    const opp = await opportunities.getOpportunity(id);
    if (!opp) return reply.code(404).send({ error: "oportunidade não encontrada" });

    const budget = await costs.assertBudget();
    if (!budget.allowed) {
      const bStatus = await costs.budgetStatus();
      const approval = await store.createApproval({
        missionId: opp.missionId ?? "mission_budget_override",
        requestedBy: act.id,
        approverRole: "owner",
        action: "budget.limit_override",
        scope: `opportunity:${id}:budget`,
        reason: budget.reason ?? "Execução acima do limite de orçamento configurado",
        correlationId,
        preview: {
          opportunityId: id,
          companyId: opp.companyId,
          reason: budget.reason,
          daily: bStatus.daily,
          monthly: bStatus.monthly,
          correlationId,
        },
      });
      await audit(act.id, "ai.budget_blocked", "Opportunity", id, correlationId, "denied", {
        reason: budget.reason,
        approvalId: approval.id,
      });
      publish(
        "approval.requested.v1",
        correlationId,
        {
          approvalId: approval.id,
          action: "budget.limit_override",
          requestedBy: act.id,
          scope: approval.scope,
          opportunityId: id,
          reason: budget.reason,
        },
        { agentId: "aegis" },
      );
      return reply.code(429).send({
        error: `orçamento de IA excedido: ${budget.reason}`,
        queuedForApproval: true,
        approval,
      });
    }

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await runOpportunityMission(
        {
          store,
          companies,
          opportunities,
          icpStore,
          offerCatalog,
          diagnoseHook: async ({ company, missionId, correlationId: cid }) => {
            const diag = await meridianDiagnose(aiGateway, {
              company: company.razaoSocial,
              source: `scout:${company.fonte}`,
              score: company.score,
              gaps: company.gaps,
              missionId,
              correlationId: cid,
              icp: ICP_HYPOTHESIS,
              approvedClaims: approvedClaimIds(),
            });
            return {
              ...(diag.diagnosis !== undefined ? { diagnosis: diag.diagnosis } : {}),
              ...(diag.justification !== undefined ? { justification: diag.justification } : {}),
              simulated: diag.simulated,
              provider: diag.provider,
              model: diag.model,
              costUnits: diag.simulated ? 2 : 5,
            };
          },
        },
        {
          opportunityId: id,
          requester: act.id,
          correlationId,
          ...(body.forceNew === true ? { forceNew: true } : {}),
          ...(typeof body.icpProfileId === "string" ? { icpProfileId: body.icpProfileId } : {}),
        },
      );
      return {
        ...result,
        mode: aiGateway.status().mode,
        simulated: aiGateway.status().mode === "simulated",
      };
    } catch (e) {
      return reply.code(409).send({ error: (e as Error).message });
    }
  });

  // Exportação autorizada — somente aprovadas por padrão; células sanitizadas contra formula injection.
  app.get("/api/scout/export", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner" && act.role !== "operator") {
      return reply.code(403).send({ error: "exportação restrita a owner/operator" });
    }
    const q = req.query as { reviewStatus?: string };
    const status = q.reviewStatus ?? "approved";
    const page = await companies.listCompanies({ reviewStatus: status as CompanyReviewStatus, pageSize: 5000 });
    const csv = companiesToCsv(page.items);
    await audit(act.id, "scout.export", "Company", status, randomUUID(), "allowed", {
      count: page.items.length, reviewStatus: status,
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="bgo-scout-${status}-${Date.now()}.csv"`);
    return reply.send(csv);
  });

  // ---- Custos de IA (Onda 10 / G95-G96) ----
  app.get("/api/costs", async (req) => {
    const q = req.query as { missionId?: string; agentId?: string; provider?: string; simulated?: string; from?: string; to?: string; limit?: string; offset?: string };
    const [usage, budget] = await Promise.all([
      costs.usage({
        ...(q.missionId ? { missionId: q.missionId } : {}),
        ...(q.agentId ? { agentId: q.agentId } : {}),
        ...(q.provider ? { provider: q.provider } : {}),
        ...(q.simulated === "true" || q.simulated === "false" ? { simulated: q.simulated === "true" } : {}),
        ...(q.from ? { from: q.from } : {}),
        ...(q.to ? { to: q.to } : {}),
        ...(q.limit ? { limit: Number(q.limit) } : {}),
        ...(q.offset ? { offset: Number(q.offset) } : {}),
      }),
      costs.budgetStatus(),
    ]);
    return {
      usage,
      budget,
      note: "estimatedCost é estimativa por tarifa versionada — nunca valor faturado; billedCost só existe quando informado pelo provedor",
      simulatedDisclaimer: "registros simulated=true são consumo de mock, não despesa real",
    };
  });

  app.get("/api/costs/tariffs", async () => costs.tariffs());

  app.post("/api/costs/tariffs", async (req, reply) => {
    const act = actor(req);
    if (act.role !== "owner") return reply.code(403).send({ error: "tarifas restritas a owner" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? Number(v) : NaN);
    const tariff = {
      version: typeof body.version === "string" ? body.version.slice(0, 60) : "",
      provider: typeof body.provider === "string" ? body.provider.slice(0, 60) : "",
      model: typeof body.model === "string" ? body.model.slice(0, 120) : "",
      currency: typeof body.currency === "string" ? body.currency.slice(0, 8) : "USD",
      inputPer1MTokens: num(body.inputPer1MTokens),
      outputPer1MTokens: num(body.outputPer1MTokens),
      active: body.active !== false,
    };
    if (!tariff.version || !tariff.provider || !tariff.model || !Number.isFinite(tariff.inputPer1MTokens) || !Number.isFinite(tariff.outputPer1MTokens)) {
      return reply.code(400).send({ error: "tarifa exige version, provider, model, inputPer1MTokens, outputPer1MTokens" });
    }
    if (tariff.inputPer1MTokens < 0 || tariff.outputPer1MTokens < 0) {
      return reply.code(400).send({ error: "tarifas não podem ser negativas" });
    }
    const created = await costs.addTariff(tariff);
    await audit(act.id, "costs.tariff.create", "AiTariff", created.id, randomUUID(), "allowed", {
      version: created.version, provider: created.provider, model: created.model,
    });
    return reply.code(201).send(created);
  });

  app.post("/api/policy/evaluate", async (req) => {
    return evaluatePolicy(req.body as Parameters<typeof evaluatePolicy>[0]);
  });

  // ---- Demo flow ----
  app.post("/api/demo/run", async (req) => {
    const input = req.body && typeof req.body === "object"
      ? CreateLeadInput.partial().parse(req.body)
      : undefined;
    const result = await runDemoFlow(store, input as Parameters<typeof runDemoFlow>[1]);
    return { ...result, mode: "mock", simulated: true };
  });

  app.get("/api/demo/status", async () => {
    const [pending, missions, leads, drafts, oppsPage, companiesPage] = await Promise.all([
      store.listApprovals("pending"),
      store.listMissions(),
      store.listLeads(),
      store.listDrafts(),
      opportunities.listOpportunities({ pageSize: 1 }),
      companies.listCompanies({ pageSize: 1 }),
    ]);
    return {
      simulated: true,
      persistence: ctx.persistence ?? "memory",
      pendingApprovals: pending.length,
      missions: missions.length,
      leads: leads.length,
      drafts: drafts.length,
      opportunities: oppsPage.total,
      companies: companiesPage.total,
    };
  });

  // ---- Outbox publisher (G53/G71): OutboxPublisher drena eventos
  // persistidos não publicados ao eventBus (SSE) com retry+backoff,
  // baseline sem replay e métricas. At-least-once; consumidores
  // deduplicam por eventId.
  const outboxStore = store as StorePort & {
    listUnpublishedEvents?: (limit?: number) => Promise<OutboxEvent[]>;
    markEventPublished?: (eventId: string) => Promise<void>;
  };
  if (typeof outboxStore.listUnpublishedEvents === "function" && typeof outboxStore.markEventPublished === "function") {
    const publisher = new OutboxPublisher(
      {
        listUnpublishedEvents: (l) => outboxStore.listUnpublishedEvents!(l),
        markEventPublished: (id) => outboxStore.markEventPublished!(id),
      },
      (ev) => {
        eventBus.publish({
          eventType: ev.eventType as Parameters<typeof eventBus.publish>[0]["eventType"],
          workspaceId: ev.workspaceId,
          correlationId: ev.correlationId,
          occurredAt: ev.occurredAt,
          payload: ev.payload,
          ...(ev.missionId !== undefined ? { missionId: ev.missionId } : {}),
          ...(ev.agentId !== undefined ? { agentId: ev.agentId } : {}),
        });
      },
      { onMetric: (name) => { if (name !== "drain") incr(`outbox.${name}`, 1); } },
    );
    publisher.start();
    app.addHook("onClose", async () => { await publisher.stop(); });
  }

  return app;
}
