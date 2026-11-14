import { lazy, Suspense, useEffect, useState } from "react";
import { useAsync } from "./hooks";
import { api, setAuthToken, type Approval, type AuditItem, type CatalogAgent, type EventItem, type SessionUser } from "./api";
import { CaptureView, LoginView } from "./views";
import { CostsView, PipelineView, ScoutView } from "./scout";
import { CommunicationView, IcpView, OfferCatalogView } from "./onda12-views";

// Code-split: o escritório 3D (three.js) só carrega ao abrir a aba
const OfficeView = lazy(() => import("./office/OfficeView").then((m) => ({ default: m.OfficeView })));

type Tab =
  | "capture"
  | "dashboard"
  | "agents"
  | "leads"
  | "scout"
  | "pipeline"
  | "icp"
  | "communication"
  | "offers"
  | "missions"
  | "approvals"
  | "costs"
  | "catalog"
  | "timeline"
  | "office";

const PUBLIC_TABS: Tab[] = ["capture"];
const TABS: { id: Tab; label: string }[] = [
  { id: "capture", label: "Captação" },
  { id: "dashboard", label: "Dashboard" },
  { id: "scout", label: "Scout" },
  { id: "pipeline", label: "Pipeline" },
  { id: "icp", label: "ICP Dinâmico" },
  { id: "communication", label: "Comunicação" },
  { id: "offers", label: "Oferta Comercial" },
  { id: "agents", label: "Agentes (6)" },
  { id: "leads", label: "Leads" },
  { id: "missions", label: "Missões" },
  { id: "approvals", label: "Aprovações" },
  { id: "costs", label: "Custos IA" },
  { id: "catalog", label: "Catálogo 29" },
  { id: "timeline", label: "Timeline" },
  { id: "office", label: "Escritório" },
];

const STATE_LABEL: Record<string, string> = {
  idle: "ocioso",
  listening: "escutando",
  processing: "processando",
  speaking: "falando",
  success: "sucesso",
  error: "erro",
};

const STATUS_BADGE: Record<string, string> = {
  new: "cyan",
  triage: "iris",
  qualified: "green",
  nurture: "gold",
  meeting_requested: "cyan",
  proposal: "magenta",
  won: "green",
  lost: "dim",
  suppressed: "red",
  draft: "dim",
  queued: "cyan",
  running: "gold",
  waiting_input: "iris",
  awaiting_approval: "magenta",
  completed: "green",
  failed: "red",
  cancelled: "dim",
  pending: "gold",
  approved: "green",
  rejected: "red",
  expired: "dim",
};

const APPROVAL_ACTION_LABEL: Record<string, string> = {
  "company.promote_opportunity": "Promoção Empresa → Oportunidade",
  "opportunity.sensitive_change": "Alteração Comercial Sensível",
  "draft.approve_review": "Aprovação de Rascunho Outbound",
  "channel.send": "Aprovação de Rascunho / Canal",
  "external.activity_request": "Criação de Atividade Externa",
  "opportunity.priority_override": "Exceção de Prioridade Comercial",
  "budget.limit_override": "Exceção de Limite de Orçamento IA",
};

function Badge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_BADGE[status] ?? "dim"}`}>{status}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Dashboard({ onRunDemo, running }: { onRunDemo: () => void; running: boolean }) {
  const agents = useAsync(() => api.agents());
  const approvals = useAsync(() => api.approvals("pending"));
  const missions = useAsync(() => api.missions());
  const leads = useAsync(() => api.leads());
  const status = useAsync(() => api.demoStatus());

  const cards = [
    { label: "Empresas Scout", value: status.data?.companies ?? "—" },
    { label: "Oportunidades Pipeline", value: status.data?.opportunities ?? "—" },
    { label: "Aprovações pendentes", value: approvals.data?.length ?? "—" },
    { label: "Leads / Missões", value: `${leads.data?.length ?? 0} / ${missions.data?.length ?? 0}` },
  ];

  return (
    <div>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <div className="muted" style={{ fontSize: 12 }}>
              {c.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--cyan)" }}>{c.value}</div>
          </div>
        ))}
      </div>
      <Section title="Fluxo demonstrativo (SIMULAÇÃO)">
        <p className="muted">
          Executa o pipeline sintético completo: lead → triagem Meridian → missão Aegis →
          distribuição Relay → dossiê Scout → qualificação → rascunho Beacon → lembrete Pledge →
          aprovação humana pendente. <strong>Nenhum envio externo é realizado.</strong>
        </p>
        <button className="btn" onClick={onRunDemo} disabled={running}>
          {running ? "Executando…" : "▶ Rodar fluxo demo"}
        </button>
        {status.data && (
          <p className="muted" style={{ marginTop: 12 }}>
            Estado: {status.data.companies ?? 0} empresas · {status.data.opportunities ?? 0} oportunidades ·{" "}
            {status.data.leads} leads · {status.data.missions} missões ·{" "}
            {status.data.pendingApprovals} aprovações pendentes · modo{" "}
            <span className="badge gold">SIMULAÇÃO</span>
          </p>
        )}
      </Section>
      <div className="grid cols-2">
        <Section title="Agentes — estado atual">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Agente</th>
                  <th>Estado</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {(agents.data ?? []).map((a) => (
                  <tr key={a.agentId}>
                    <td>
                      <b>{a.displayName}</b> <span className="muted mono">{a.agentId}</span>
                    </td>
                    <td>{STATE_LABEL[a.visual.state] ?? a.visual.state}</td>
                    <td>
                      {a.visual.awaitingApproval && <span className="badge magenta">aguardando aprovação</span>}{" "}
                      {a.visual.simulated && <span className="badge gold">simulado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Missões recentes">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Goal</th>
                  <th>Status</th>
                  <th>Correlação</th>
                </tr>
              </thead>
              <tbody>
                {(missions.data ?? [])
                  .slice(-6)
                  .reverse()
                  .map((m) => (
                    <tr key={m.id}>
                      <td>{m.goal.slice(0, 60)}…</td>
                      <td>
                        <Badge status={m.status} />
                      </td>
                      <td className="mono muted">{m.correlationId.slice(0, 8)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  );
}

function AgentsView() {
  const agents = useAsync(() => api.agents());
  return (
    <Section title="Equipe ativa — 6 especialistas (modo simulação)">
      {agents.loading && <div className="loading">carregando…</div>}
      {agents.error && <div className="error-box">{agents.error} — a API está no ar? (pnpm dev:api)</div>}
      <div className="grid cols-3">
        {(agents.data ?? []).map((a) => (
          <div className="card agent-card" key={a.agentId} style={{ ["--agent-color" as string]: "var(--iris)" }}>
            <h3>
              {a.displayName} <span className="mono muted">{a.agentId}</span>
            </h3>
            <p className="muted" style={{ minHeight: 40 }}>
              {a.summary}
            </p>
            <div>
              Estação: <b>{a.station ?? "—"}</b>
            </div>
            <div className="muted">
              Autonomia máx: {a.autonomyCeiling} · {a.implementationStatus}
            </div>
            <div className="agent-state">
              <span className="badge cyan">{STATE_LABEL[a.visual.state]}</span>
              {a.visual.awaitingApproval && <span className="badge magenta">aguardando aprovação</span>}
              <span className="badge gold">simulado</span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LeadsView() {
  const leads = useAsync(() => api.leads());
  return (
    <Section title="Leads (dados sintéticos)">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Empresa</th>
              <th>Contato</th>
              <th>Fonte</th>
              <th>Status</th>
              <th>Tipo</th>
              <th>Capturado</th>
            </tr>
          </thead>
          <tbody>
            {(leads.data ?? []).map((l) => (
              <tr key={l.id}>
                <td>{l.name ?? "—"}</td>
                <td>{l.company ?? "—"}</td>
                <td className="muted">{l.email ?? l.phone ?? "—"}</td>
                <td>
                  <span className="mono">{l.source}</span>
                </td>
                <td>
                  <Badge status={l.status} />
                </td>
                <td>
                  {l.synthetic ? <span className="badge gold">SIMULAÇÃO</span> : <span className="badge cyan">REAL</span>}
                </td>
                <td className="mono muted">{new Date(l.capturedAt).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!(leads.data ?? []).length && <p className="muted">Nenhum lead ainda — use a aba Captação ou rode o fluxo demo.</p>}
    </Section>
  );
}

function MissionsView() {
  const missions = useAsync(() => api.missions());
  const [open, setOpen] = useState<string | null>(null);
  const detail = useAsync(() => (open ? api.mission(open) : Promise.resolve(null)), [open]);
  return (
    <div className="grid cols-2">
      <Section title="Missões">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Goal</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(missions.data ?? [])
                .slice()
                .reverse()
                .map((m) => (
                  <tr key={m.id}>
                    <td>{m.goal.slice(0, 50)}…</td>
                    <td>
                      <Badge status={m.status} />
                    </td>
                    <td>
                      <button className="btn secondary small" onClick={() => setOpen(m.id)}>
                        ver
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Detalhe da missão">
        {detail.data ? (
          <div>
            <dl className="kv">
              <dt>Status</dt>
              <dd>
                <Badge status={detail.data.status} />
              </dd>
              <dt>Correlação</dt>
              <dd className="mono">{detail.data.correlationId}</dd>
              <dt>Runs</dt>
              <dd>
                {(detail.data.runs ?? []).map((r) => (
                  <div key={r.id ?? r.agentId + r.status}>
                    <span className="mono">{r.agentId}</span> — <Badge status={r.status} />{" "}
                    {r.mock && <span className="badge gold">mock</span>}
                  </div>
                ))}
              </dd>
            </dl>
          </div>
        ) : (
          <p className="muted">Selecione uma missão.</p>
        )}
      </Section>
    </div>
  );
}

function ApprovalsView({ onDecide }: { onDecide: (id: string, d: "approved" | "rejected", reason?: string) => Promise<void> }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [reqAction, setReqAction] = useState("external.activity_request");
  const [reqScope, setReqScope] = useState("calendar:followup_meeting");
  const [reqReason, setReqReason] = useState("Agendamento de atividade externa de follow-up comercial");
  const [reqMsg, setReqMsg] = useState<string | null>(null);

  const approvals = useAsync(
    () => api.approvals(statusFilter, actionFilter || undefined),
    [statusFilter, actionFilter],
  );

  const decide = async (a: Approval, d: "approved" | "rejected") => {
    setBusy(a.id);
    try {
      const reason =
        decisionReason[a.id]?.trim() ||
        (d === "approved"
          ? "Autorizado na Central de Aprovações (sem envio externo automático)"
          : "Rejeitado na Central de Aprovações");
      await onDecide(a.id, d, reason);
      approvals.reload();
    } finally {
      setBusy(null);
    }
  };

  const submitSupervisedRequest = async () => {
    setReqMsg(null);
    try {
      const created = await api.requestApproval({
        action: reqAction,
        scope: reqScope,
        reason: reqReason,
        preview: { requestedVia: "Central de Aprovações UI" },
      });
      setReqMsg(`Solicitação ${created.id} registrada com status '${created.status}'.`);
      approvals.reload();
    } catch (e) {
      setReqMsg(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <Section title="Central de Aprovações e Supervisão Humana (Fase 05 / G136)">
        <p className="muted">
          Consolida toda supervisão humana obrigatória: promoção de empresa para oportunidade, alterações comerciais sensíveis,
          aprovação de rascunhos, criação de atividades externas, exceções de prioridade e limites de orçamento.
          Aprovar um rascunho <b>não implica envio automático</b> — o registro permanece interno e auditado.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select
            data-testid="approvals-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="pending">pendentes</option>
            <option value="approved">aprovadas</option>
            <option value="rejected">rejeitadas</option>
            <option value="all">todas</option>
          </select>
          <select
            data-testid="approvals-filter-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="">todos os tipos de ação</option>
            <option value="company.promote_opportunity">Promoção Empresa → Oportunidade</option>
            <option value="opportunity.sensitive_change">Alteração Comercial Sensível</option>
            <option value="draft.approve_review">Aprovação de Rascunho Outbound</option>
            <option value="channel.send">Rascunho / Canal (Demo)</option>
            <option value="external.activity_request">Criação de Atividade Externa</option>
            <option value="opportunity.priority_override">Exceção de Prioridade Comercial</option>
            <option value="budget.limit_override">Exceção de Limite de Orçamento</option>
          </select>
        </div>

        <div className="table-wrap">
          <table data-testid="approvals-table">
            <thead>
              <tr>
                <th>O quê / Escopo</th>
                <th>Quem solicitou / Quando</th>
                <th>Contexto e Justificativa</th>
                <th>Status / Decisão</th>
                <th>Ação Humana</th>
              </tr>
            </thead>
            <tbody>
              {(approvals.data ?? []).map((a) => (
                <tr key={a.id} data-testid={`approval-row-${a.id}`}>
                  <td>
                    <b>{APPROVAL_ACTION_LABEL[a.action] ?? a.action}</b>
                    <br />
                    <span className="mono muted">{a.action}</span>
                    <br />
                    <span className="mono tiny muted">escopo: {a.scope}</span>
                  </td>
                  <td>
                    <span className="mono">{a.requestedBy}</span>
                    <br />
                    <span className="mono muted tiny">{new Date(a.createdAt).toLocaleString("pt-BR")}</span>
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    <div>{a.reason}</div>
                    <div className="mono muted tiny">missão: {a.missionId}</div>
                  </td>
                  <td>
                    <Badge status={a.status} />
                    {a.decidedBy && (
                      <div className="mono tiny muted" style={{ marginTop: 4 }}>
                        Por: <b>{a.decidedBy}</b>
                        <br />
                        Em: {a.decidedAt ? new Date(a.decidedAt).toLocaleString("pt-BR") : "—"}
                        {a.decidedReason ? (
                          <>
                            <br />
                            Obs: {a.decidedReason}
                          </>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: 210 }}>
                    {a.status === "pending" ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        <input
                          placeholder="Observação / motivo da decisão"
                          data-testid={`approval-reason-${a.id}`}
                          value={decisionReason[a.id] ?? ""}
                          onChange={(e) => setDecisionReason((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          style={{ fontSize: 12 }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn small"
                            data-testid={`approval-approve-${a.id}`}
                            disabled={busy === a.id}
                            onClick={() => decide(a, "approved")}
                          >
                            Aprovar
                          </button>
                          <button
                            className="btn danger small"
                            data-testid={`approval-reject-${a.id}`}
                            disabled={busy === a.id}
                            onClick={() => decide(a, "rejected")}
                          >
                            Rejeitar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="muted tiny">Decisão consolidada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!(approvals.data ?? []).length && <p className="muted">Nenhuma aprovação encontrada para este filtro.</p>}
      </Section>

      <Section title="Registrar Solicitação de Supervisão Humana">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            data-testid="approval-req-action"
            value={reqAction}
            onChange={(e) => setReqAction(e.target.value)}
          >
            <option value="external.activity_request">Criação de atividade externa</option>
            <option value="opportunity.sensitive_change">Alteração comercial sensível</option>
            <option value="budget.limit_override">Exceção de limite de orçamento</option>
            <option value="opportunity.priority_override">Exceção de prioridade comercial</option>
          </select>
          <input
            data-testid="approval-req-scope"
            placeholder="Escopo (ex.: calendar:followup)"
            value={reqScope}
            onChange={(e) => setReqScope(e.target.value)}
          />
          <input
            data-testid="approval-req-reason"
            placeholder="Contexto e motivo da solicitação"
            value={reqReason}
            onChange={(e) => setReqReason(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button className="btn secondary small" data-testid="approval-req-submit" onClick={submitSupervisedRequest}>
            Solicitar aprovação
          </button>
        </div>
        {reqMsg && (
          <p data-testid="approval-req-msg" style={{ color: "var(--cyan)", marginTop: 8 }}>
            {reqMsg}
          </p>
        )}
      </Section>
    </div>
  );
}

function CatalogView() {
  const catalog = useAsync(() => api.catalog());
  const [filter, setFilter] = useState<"all" | "active" | "pillar" | "commercial" | "channel" | "supervision">("all");
  const agents = (catalog.data?.agents ?? []).filter((a: CatalogAgent) => {
    if (filter === "all") return true;
    if (filter === "active") return a.active;
    return a.layer === filter;
  });
  const personas = catalog.data?.personas ?? [];
  const roleOf = (id: string) => personas.find((p) => p.id === id)?.role ?? "";
  return (
    <div>
      <Section title={`Catálogo canônico — ${catalog.data?.meta.total ?? 29} personagens`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(["all", "active", "pillar", "commercial", "channel", "supervision"] as const).map((f) => (
            <button
              key={f}
              className="btn secondary small"
              onClick={() => setFilter(f)}
              style={filter === f ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Papel</th>
                <th>Camada</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.agentId}>
                  <td className="mono">{a.agentId}</td>
                  <td>
                    <b>{a.displayName}</b>
                  </td>
                  <td className="muted">{roleOf(a.agentId)}</td>
                  <td>
                    <span className="badge iris">{a.layer}</span>
                  </td>
                  <td>
                    {a.active ? (
                      <span className="badge cyan">ATIVO · SIMULADO</span>
                    ) : (
                      <span className="badge dim">PLANEJADO</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function TimelineView() {
  const events = useAsync(() => api.events());
  const audit = useAsync(() => api.audit());
  const [tab, setTab] = useState<"events" | "audit">("events");
  return (
    <Section title="Trilha auditável">
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          className="btn secondary small"
          onClick={() => setTab("events")}
          style={tab === "events" ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}
        >
          Eventos
        </button>
        <button
          className="btn secondary small"
          onClick={() => setTab("audit")}
          style={tab === "audit" ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}
        >
          Auditoria
        </button>
      </div>
      <div className="timeline">
        {tab === "events"
          ? (events.data ?? [])
              .slice()
              .reverse()
              .map((e: EventItem) => (
                <div className="ev" key={e.eventId}>
                  <span className="t mono">{new Date(e.occurredAt).toLocaleTimeString("pt-BR")}</span>
                  <span className="type mono">{e.eventType}</span>{" "}
                  {e.agentId && <span className="badge iris">{e.agentId}</span>}{" "}
                  <span className="muted mono">corr:{e.correlationId.slice(0, 8)}</span>
                </div>
              ))
          : (audit.data ?? [])
              .slice()
              .reverse()
              .map((a: AuditItem) => (
                <div className="ev" key={a.id}>
                  <span className="t mono">{new Date(a.occurredAt).toLocaleTimeString("pt-BR")}</span>
                  <b>{a.actor}</b> {a.action} <span className="muted">{a.entity}</span>{" "}
                  <span className={`badge ${a.outcome === "denied" ? "red" : a.outcome === "allowed" ? "green" : "dim"}`}>
                    {a.outcome}
                  </span>
                </div>
              ))}
      </div>
    </Section>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pipelineOppId, setPipelineOppId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (authChecked && !user && tab !== "capture") setTab("capture");
  }, [user, authChecked]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setAuthToken(null);
    setUser(null);
  };

  const runDemo = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const r = await api.runDemo();
      setNotice(
        `Fluxo concluído (correlação ${r.correlationId.slice(0, 8)}…). Aprovação pendente: ${r.approvalId.slice(0, 8)}… — modo SIMULAÇÃO.`,
      );
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const decide = async (id: string, d: "approved" | "rejected", reason?: string) => {
    await api.decideApproval(id, d, reason ?? (d === "rejected" ? "rejeitado via UI" : undefined));
    setNotice(`Decisão (${d}) registrada na Central de Aprovações — estado comercial atualizado. Nenhum envio externo realizado.`);
  };

  const openPipeline = (oppId?: string) => {
    if (oppId) setPipelineOppId(oppId);
    setTab("pipeline");
  };

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">
          Birthub <span className="go">Growth</span> <span className="enlouq">Office</span>
        </div>
        <span className="sim-badge">MODO SIMULAÇÃO</span>
        {user && (
          <span className="muted" style={{ fontSize: 12 }}>
            {user.name} · {user.role}{" "}
            <button className="btn secondary small" onClick={logout}>
              sair
            </button>
          </span>
        )}
        <nav className="nav" aria-label="Seções">
          {TABS.filter((t) => user || PUBLIC_TABS.includes(t.id)).map((t) => (
            <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {notice && (
          <div className="card" style={{ borderColor: "var(--cyan)", marginBottom: 16 }}>
            {notice}
          </div>
        )}
        {tab === "capture" && <CaptureView />}
        {authChecked && !user && (
          <LoginView
            onLogin={(u) => {
              setUser(u);
              setTab("dashboard");
            }}
          />
        )}
        {user && tab === "dashboard" && <Dashboard onRunDemo={runDemo} running={running} />}
        {user && tab === "scout" && <ScoutView onOpenPipeline={openPipeline} />}
        {user && tab === "pipeline" && <PipelineView initialOpportunityId={pipelineOppId} />}
        {user && tab === "icp" && <IcpView />}
        {user && tab === "communication" && <CommunicationView />}
        {user && tab === "offers" && <OfferCatalogView />}
        {user && tab === "agents" && <AgentsView />}
        {user && tab === "leads" && <LeadsView />}
        {user && tab === "missions" && <MissionsView />}
        {user && tab === "approvals" && <ApprovalsView onDecide={decide} />}
        {user && tab === "costs" && <CostsView />}
        {user && tab === "catalog" && <CatalogView />}
        {user && tab === "timeline" && <TimelineView />}
        {user && tab === "office" && (
          <Suspense fallback={<div className="card muted">Carregando escritório 3D…</div>}>
            <OfficeView onOpenScout={() => setTab("scout")} onOpenPipeline={openPipeline} />
          </Suspense>
        )}
        <footer className="muted" style={{ marginTop: 24, fontSize: 12 }}>
          Birthub Growth Office · Onda 12 · persistência local · nenhum envio externo ·{" "}
          <span className="badge gold">SIMULAÇÃO</span>
        </footer>
      </main>
    </div>
  );
}
