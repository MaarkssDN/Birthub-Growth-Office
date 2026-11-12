import { useEffect, useState } from "react";
import { useAsync } from "./hooks";
import { api, setAuthToken, type AuditItem, type CatalogAgent, type EventItem, type SessionUser } from "./api";
import { CaptureView, LoginView } from "./views";
import { OfficeView } from "./office/OfficeView";

type Tab = "capture" | "dashboard" | "agents" | "leads" | "missions" | "approvals" | "catalog" | "timeline" | "office";

const PUBLIC_TABS: Tab[] = ["capture"];
const TABS: { id: Tab; label: string }[] = [
  { id: "capture", label: "Captação" },
  { id: "dashboard", label: "Dashboard" },
  { id: "agents", label: "Agentes (6)" },
  { id: "leads", label: "Leads" },
  { id: "missions", label: "Missões" },
  { id: "approvals", label: "Aprovações" },
  { id: "catalog", label: "Catálogo 29" },
  { id: "timeline", label: "Timeline" },
  { id: "office", label: "Escritório" },
];


const STATE_LABEL: Record<string, string> = {
  idle: "ocioso", listening: "escutando", processing: "processando",
  speaking: "falando", success: "sucesso", error: "erro",
};

const STATUS_BADGE: Record<string, string> = {
  new: "cyan", triage: "iris", qualified: "green", nurture: "gold",
  meeting_requested: "cyan", proposal: "magenta", won: "green", lost: "dim", suppressed: "red",
  draft: "dim", queued: "cyan", running: "gold", waiting_input: "iris",
  awaiting_approval: "magenta", completed: "green", failed: "red", cancelled: "dim",
  pending: "gold", approved: "green", rejected: "red", expired: "dim",
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
    { label: "Leads", value: leads.data?.length ?? "—" },
    { label: "Missões", value: missions.data?.length ?? "—" },
    { label: "Aprovações pendentes", value: approvals.data?.length ?? "—" },
    { label: "Agentes ativos", value: agents.data?.length ?? "—" },
  ];

  return (
    <div>
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <div className="muted" style={{ fontSize: 12 }}>{c.label}</div>
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
            Estado: {status.data.leads} leads · {status.data.missions} missões ·{" "}
            {status.data.pendingApprovals} aprovações pendentes · modo {""}
            <span className="badge gold">SIMULAÇÃO</span>
          </p>
        )}
      </Section>
      <div className="grid cols-2">
        <Section title="Agentes — estado atual">
          <table>
            <thead><tr><th>Agente</th><th>Estado</th><th>Flags</th></tr></thead>
            <tbody>
              {(agents.data ?? []).map((a) => (
                <tr key={a.agentId}>
                  <td><b>{a.displayName}</b> <span className="muted mono">{a.agentId}</span></td>
                  <td>{STATE_LABEL[a.visual.state] ?? a.visual.state}</td>
                  <td>
                    {a.visual.awaitingApproval && <span className="badge magenta">aguardando aprovação</span>}{" "}
                    {a.visual.simulated && <span className="badge gold">simulado</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <Section title="Missões recentes">
          <table>
            <thead><tr><th>Goal</th><th>Status</th><th>Correlação</th></tr></thead>
            <tbody>
              {(missions.data ?? []).slice(-6).reverse().map((m) => (
                <tr key={m.id}>
                  <td>{m.goal.slice(0, 60)}…</td>
                  <td><Badge status={m.status} /></td>
                  <td className="mono muted">{m.correlationId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <h3>{a.displayName} <span className="mono muted">{a.agentId}</span></h3>
            <p className="muted" style={{ minHeight: 40 }}>{a.summary}</p>
            <div>Estação: <b>{a.station ?? "—"}</b></div>
            <div className="muted">Autonomia máx: {a.autonomyCeiling} · {a.implementationStatus}</div>
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
      <table>
        <thead><tr><th>Nome</th><th>Empresa</th><th>Contato</th><th>Fonte</th><th>Status</th><th>Tipo</th><th>Capturado</th></tr></thead>
        <tbody>
          {(leads.data ?? []).map((l) => (
            <tr key={l.id}>
              <td>{l.name ?? "—"}</td>
              <td>{l.company ?? "—"}</td>
              <td className="muted">{l.email ?? l.phone ?? "—"}</td>
              <td><span className="mono">{l.source}</span></td>
              <td><Badge status={l.status} /></td>
              <td>{l.synthetic ? <span className="badge gold">SIMULAÇÃO</span> : <span className="badge cyan">REAL</span>}</td>
              <td className="mono muted">{new Date(l.capturedAt).toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!(leads.data ?? []).length && <p className="muted">Nenhum lead ainda — use a aba Captação ou rode o fluxo demo.</p>}
    </Section>
  );
}

function MissionsView() {
  const missions = useAsync(() => api.missions());
  const [open, setOpen] = useState<string | null>(null);
  const detail = useAsync(
    () => (open ? api.mission(open) : Promise.resolve(null)),
    [open],
  );
  return (
    <div className="grid cols-2">
      <Section title="Missões">
        <table>
          <thead><tr><th>Goal</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(missions.data ?? []).slice().reverse().map((m) => (
              <tr key={m.id}>
                <td>{m.goal.slice(0, 50)}…</td>
                <td><Badge status={m.status} /></td>
                <td><button className="btn secondary small" onClick={() => setOpen(m.id)}>ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Detalhe da missão">
        {detail.data ? (
          <div>
            <dl className="kv">
              <dt>Status</dt><dd><Badge status={detail.data.status} /></dd>
              <dt>Correlação</dt><dd className="mono">{detail.data.correlationId}</dd>
              <dt>Runs</dt>
              <dd>
                {(detail.data.runs ?? []).map((r) => (
                  <div key={r.agentId + r.status}>
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

function ApprovalsView({ onDecide }: { onDecide: (id: string, d: "approved" | "rejected") => void }) {
  const approvals = useAsync(() => api.approvals("pending"));
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (id: string, d: "approved" | "rejected") => {
    setBusy(id);
    try { await onDecide(id, d); approvals.reload(); } finally { setBusy(null); }
  };
  return (
    <Section title="Fila de aprovação humana">
      <p className="muted">
        Aprovações são obrigatórias para qualquer ação externa futura. Aprovar aqui <b>não envia nada</b> —
        o rascunho permanece interno e marcado como simulado.
      </p>
      <table>
        <thead><tr><th>Ação</th><th>Solicitante</th><th>Motivo</th><th>Decisão</th></tr></thead>
        <tbody>
          {(approvals.data ?? []).map((a) => (
            <tr key={a.id}>
              <td><span className="mono">{a.action}</span><br /><span className="muted mono">{a.scope}</span></td>
              <td className="mono">{a.requestedBy}</td>
              <td className="muted">{a.reason}</td>
              <td>
                <button className="btn small" disabled={busy === a.id} onClick={() => decide(a.id, "approved")}>Aprovar</button>{" "}
                <button className="btn danger small" disabled={busy === a.id} onClick={() => decide(a.id, "rejected")}>Rejeitar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!(approvals.data ?? []).length && <p className="muted">Nenhuma aprovação pendente.</p>}
    </Section>
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
            <button key={f} className={`btn secondary small ${filter === f ? "" : ""}`} onClick={() => setFilter(f)}
              style={filter === f ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}>
              {f}
            </button>
          ))}
        </div>
        <table>
          <thead><tr><th>ID</th><th>Nome</th><th>Papel</th><th>Camada</th><th>Status</th></tr></thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.agentId}>
                <td className="mono">{a.agentId}</td>
                <td><b>{a.displayName}</b></td>
                <td className="muted">{roleOf(a.agentId)}</td>
                <td><span className="badge iris">{a.layer}</span></td>
                <td>
                  {a.active
                    ? <span className="badge cyan">ATIVO · SIMULADO</span>
                    : <span className="badge dim">PLANEJADO</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <button className="btn secondary small" onClick={() => setTab("events")} style={tab === "events" ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}>Eventos</button>
        <button className="btn secondary small" onClick={() => setTab("audit")} style={tab === "audit" ? { borderColor: "var(--cyan)", color: "var(--cyan)" } : {}}>Auditoria</button>
      </div>
      <div className="timeline">
        {tab === "events"
          ? (events.data ?? []).slice().reverse().map((e: EventItem) => (
              <div className="ev" key={e.eventId}>
                <span className="t mono">{new Date(e.occurredAt).toLocaleTimeString("pt-BR")}</span>
                <span className="type mono">{e.eventType}</span>{" "}
                {e.agentId && <span className="badge iris">{e.agentId}</span>}{" "}
                <span className="muted mono">corr:{e.correlationId.slice(0, 8)}</span>
              </div>
            ))
          : (audit.data ?? []).slice().reverse().map((a: AuditItem) => (
              <div className="ev" key={a.id}>
                <span className="t mono">{new Date(a.occurredAt).toLocaleTimeString("pt-BR")}</span>
                <b>{a.actor}</b> {a.action} <span className="muted">{a.entity}</span>{" "}
                <span className={`badge ${a.outcome === "denied" ? "red" : a.outcome === "allowed" ? "green" : "dim"}`}>{a.outcome}</span>
              </div>
            ))}
      </div>
    </Section>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    api.me()
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
      setNotice(`Fluxo concluído (correlação ${r.correlationId.slice(0, 8)}…). Aprovação pendente: ${r.approvalId.slice(0, 8)}… — modo SIMULAÇÃO.`);
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const decide = async (id: string, d: "approved" | "rejected") => {
    await api.decideApproval(id, d, d === "rejected" ? "rejeitado via UI" : undefined);
    setNotice(`Approval ${d} registrada — missão atualizada. Nada foi enviado externamente.`);
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
            <button className="btn secondary small" onClick={logout}>sair</button>
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
        {notice && <div className="card" style={{ borderColor: "var(--cyan)", marginBottom: 16 }}>{notice}</div>}
        {tab === "capture" && <CaptureView />}
        {authChecked && !user && <LoginView onLogin={(u) => { setUser(u); setTab("dashboard"); }} />}
        {user && tab === "dashboard" && <Dashboard onRunDemo={runDemo} running={running} />}
        {user && tab === "agents" && <AgentsView />}
        {user && tab === "leads" && <LeadsView />}
        {user && tab === "missions" && <MissionsView />}
        {user && tab === "approvals" && <ApprovalsView onDecide={decide} />}
        {user && tab === "catalog" && <CatalogView />}
        {user && tab === "timeline" && <TimelineView />}
        {user && tab === "office" && <OfficeView />}
        <footer className="muted" style={{ marginTop: 24, fontSize: 12 }}>
          Birthub Growth Office · Onda 01 · persistência local · nenhum envio externo ·{" "}
          <span className="badge gold">SIMULAÇÃO</span>
        </footer>
      </main>
    </div>
  );
}
