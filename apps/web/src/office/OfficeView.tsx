import { useMemo, useState } from "react";
import { Section } from "../views";
import { api, type Persona } from "../api";
import { useAsync } from "../hooks";
import { useOfficeEvents } from "./useOfficeEvents";
import { OfficeScene } from "./Office3D";
import type { AgentColors } from "./characters";

const STATE_LABEL: Record<string, string> = {
  idle: "ocioso",
  listening: "atento",
  processing: "processando",
  speaking: "comunicando",
  success: "sucesso",
  error: "erro",
};

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const FALLBACK_COLORS: Record<string, AgentColors> = {
  aegis: { primary: "#ffc107", secondary: "#b8860b", accent: "#ffe08a" },
  relay: { primary: "#00d4ff", secondary: "#0891b2", accent: "#7dd3fc" },
  scout: { primary: "#38bdf8", secondary: "#0369a1", accent: "#93c5fd" },
  meridian: { primary: "#a78bfa", secondary: "#6d28d9", accent: "#c4b5fd" },
  beacon: { primary: "#ff2d9b", secondary: "#be185d", accent: "#f9a8d4" },
  pledge: { primary: "#34d399", secondary: "#047857", accent: "#a7f3d0" },
};

export function OfficeView({
  onOpenScout,
  onOpenPipeline,
}: {
  onOpenScout?: () => void;
  onOpenPipeline?: (opportunityId?: string) => void;
}) {
  const catalog = useAsync(() => api.catalog());
  const agents = useAsync(() => api.agents());
  const { events, agents: agentVisuals, live } = useOfficeEvents();
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gl] = useState(webglAvailable);

  const colorsByAgent = useMemo(() => {
    const map: Record<string, AgentColors> = { ...FALLBACK_COLORS };
    for (const p of (catalog.data?.personas ?? []) as Persona[]) {
      if (p.id in FALLBACK_COLORS) {
        map[p.id] = { primary: p.colors.primary, secondary: p.colors.secondary, accent: p.colors.accent };
      }
    }
    return map;
  }, [catalog.data]);

  const visualMap = useMemo(
    () => Object.fromEntries(agentVisuals.map((a) => [a.id, a.visual])),
    [agentVisuals],
  );

  const byId = new Map((agents.data ?? []).map((a) => [a.agentId, a]));
  const selAgent = selected ? byId.get(selected) : undefined;
  const selVisual = selected ? visualMap[selected] : undefined;
  const selEvents = selected
    ? events.filter((e) => e.agentId === selected).slice(-6).reverse()
    : [];

  const runDemo = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const r = await api.runDemo();
      setNotice(
        `Missão registrada — correlação ${r.correlationId.slice(0, 8)}. Observe os bonequinhos reagirem aos eventos reais. Aprovação pendente; nada é enviado externamente.`,
      );
      agents.reload();
    } catch (e) {
      setNotice(`Erro: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Section title="Escritório virtual 3D — eventos reais">
      <div className="office-wrap">
        <div className="office-stage">
          {gl ? (
            <OfficeScene
              colorsByAgent={colorsByAgent}
              agentVisuals={visualMap}
              selectedAgent={selected ?? undefined}
              onSelectAgent={setSelected}
              selectedMission={selVisual?.correlationId?.slice(0, 8)}
            />
          ) : (
            <div className="office-nogl">
              <b>WebGL indisponível neste dispositivo</b>
              <p>Use a lista de estações abaixo — todos os recursos comerciais seguem acessíveis sem a cena 3D.</p>
            </div>
          )}
          <div className="office-hud">
            <span className={`badge ${live ? "green" : "dim"}`}>{live ? "● eventos ao vivo (SSE)" : "○ histórico"}</span>
            <span className="badge gold">SIMULAÇÃO</span>
            <button className="btn small" data-testid="office-run-demo" onClick={runDemo} disabled={running}>
              {running ? "Executando…" : "▶ Executar missão demo"}
            </button>
          </div>
          {notice && <div className="office-notice">{notice}</div>}
        </div>

        <aside className="office-panel">
          <h3>Agentes</h3>
          <div className="office-agent-list">
            {agentVisuals.map(({ id, visual }) => {
              const a = byId.get(id);
              return (
                <button
                  key={id}
                  data-testid={`office-agent-btn-${id}`}
                  className={`office-agent ${selected === id ? "sel" : ""}`}
                  onClick={() => setSelected(selected === id ? null : id)}
                >
                  <span className="dot" style={{ background: colorsByAgent[id]?.accent ?? "#888" }} />
                  <b>{a?.displayName ?? id}</b>
                  <span className={`badge st-${visual.state}`}>{STATE_LABEL[visual.state] ?? visual.state}</span>
                  {visual.lastEvent && <span className="muted mono tiny">{visual.lastEvent}</span>}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="office-detail" data-testid={`office-detail-${selected}`}>
              <h3>{selAgent?.displayName ?? selected}</h3>
              <p className="muted">{selAgent?.summary ?? ""}</p>
              <div className="kv">
                <span>Estado</span>
                <b className={`st-${selVisual?.state ?? "idle"}`}>{STATE_LABEL[selVisual?.state ?? "idle"]}</b>
              </div>
              <div className="kv">
                <span>Estação</span>
                <b>{selAgent?.station ?? "—"}</b>
              </div>
              <div className="kv">
                <span>Autonomia</span>
                <b>{selAgent?.autonomyCeiling ?? "—"}</b>
              </div>
              <div className="kv">
                <span>Último evento</span>
                <b className="mono tiny">{selVisual?.lastEvent ?? "—"}</b>
              </div>
              {selVisual?.correlationId && (
                <div className="kv">
                  <span>Correlação</span>
                  <b className="mono tiny">{selVisual.correlationId.slice(0, 13)}…</b>
                </div>
              )}
              {selAgent?.visual.awaitingApproval && <span className="badge magenta">aprovação humana pendente</span>}

              <AgentCommercialContext
                agentId={selected}
                {...(onOpenScout ? { onOpenScout } : {})}
                {...(onOpenPipeline ? { onOpenPipeline } : {})}
              />

              <h4>Eventos recentes</h4>
              {selEvents.length === 0 && <p className="muted tiny">Nenhum evento ainda — execute uma missão demo.</p>}
              {selEvents.map((e) => (
                <div className="ev tiny" key={e.eventId}>
                  <span className="t mono">{new Date(e.occurredAt).toLocaleTimeString("pt-BR")}</span>
                  <span className="type mono">{e.eventType}</span>
                </div>
              ))}
            </div>
          )}

          <p className="muted tiny" style={{ marginTop: 12 }}>
            Bonequinhos 3D são <b>protótipos visuais procedurais</b> (primitivas Three.js), não os assets finais.
            Estados reagem somente a eventos reais da API; execuções são simuladas e ações externas bloqueadas.
          </p>
        </aside>
      </div>
    </Section>
  );
}

/**
 * Painel contextual comercial por agente (Onda 11 / Fase 06):
 * - Scout: dossiê de contas importadas/aprovadas
 * - Aegis: missão comercial supervisionada
 * - Relay: coordenação e tarefas
 * - Meridian: atividade de qualificação SDR e lacunas
 * - Beacon: rascunho de prospecção outbound (sem envio externo)
 * - Pledge: acompanhamento de follow-ups e aprovações
 */
function AgentCommercialContext({
  agentId,
  onOpenScout,
  onOpenPipeline,
}: {
  agentId: string;
  onOpenScout?: () => void;
  onOpenPipeline?: (opportunityId?: string) => void;
}) {
  const companies = useAsync(() => api.scoutCompanies({ pageSize: "5" }), [agentId]);
  const opportunities = useAsync(() => api.opportunities({ pageSize: "5" }), [agentId]);
  const missions = useAsync(() => api.missions(), [agentId]);
  const drafts = useAsync(() => api.drafts(), [agentId]);
  const approvals = useAsync(() => api.approvals("pending"), [agentId]);
  const activeIcp = useAsync(() => api.getActiveIcp(), [agentId]);
  const dispatches = useAsync(() => api.listCommunicationDispatches(), [agentId]);

  const topCompany = companies.data?.items[0];
  const topOpp = opportunities.data?.items[0];
  const latestMission = (missions.data ?? []).at(-1);
  const latestDraft = (drafts.data ?? [])[0];
  const pendingCount = approvals.data?.length ?? 0;

  if (agentId === "scout") {
    return (
      <div data-testid="office-scout-context" style={{ marginTop: 10 }}>
        <h4>Dossiê Scout — Investigação de Contas</h4>
        <div className="kv">
          <span>Empresas na Central</span>
          <b>{companies.data?.total ?? 0}</b>
        </div>
        <div className="kv">
          <span>Oportunidades no Pipeline</span>
          <b>{opportunities.data?.total ?? 0}</b>
        </div>
        <div className="kv">
          <span>ICP Vigente</span>
          <b>{activeIcp.data?.name ?? "ICP Padrão"} v{activeIcp.data?.version ?? 1}</b>
        </div>
        {topCompany ? (
          <div style={{ margin: "6px 0", fontSize: 12 }}>
            <div>
              <b>Último dossiê:</b> {topCompany.razaoSocial} (<span className="mono">{topCompany.cnpj}</span>)
            </div>
            <div className="muted">
              Score ICP {topCompany.score}/100 · {topCompany.reasons.length} evidências · status {topCompany.reviewStatus}
            </div>
          </div>
        ) : (
          <p className="muted tiny">Nenhuma empresa importada ainda.</p>
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {onOpenScout && (
            <button className="btn small" onClick={onOpenScout}>
              Abrir Central Scout
            </button>
          )}
          {onOpenPipeline && (
            <button className="btn secondary small" onClick={() => onOpenPipeline(topOpp?.id)}>
              Abrir Pipeline
            </button>
          )}
        </div>
      </div>
    );
  }

  if (agentId === "aegis") {
    return (
      <div data-testid="office-aegis-context" style={{ marginTop: 10 }}>
        <h4>Missão Comercial — Supervisão Aegis</h4>
        <div className="kv">
          <span>Missões registradas</span>
          <b>{missions.data?.length ?? 0}</b>
        </div>
        {latestMission ? (
          <div style={{ margin: "6px 0", fontSize: 12 }}>
            <div>
              <b>Missão ativa:</b> {latestMission.goal}
            </div>
            <div className="mono muted">
              Status: {latestMission.status} · corr {latestMission.correlationId.slice(0, 8)}
            </div>
          </div>
        ) : (
          <p className="muted tiny">Nenhuma missão iniciada.</p>
        )}
      </div>
    );
  }

  if (agentId === "relay") {
    return (
      <div data-testid="office-relay-context" style={{ marginTop: 10 }}>
        <h4>Coordenação Comercial — Relay</h4>
        <div className="kv">
          <span>Oportunidades coordenadas</span>
          <b>{opportunities.data?.total ?? 0}</b>
        </div>
        <div className="kv">
          <span>Tarefas na última missão</span>
          <b>{(latestMission?.tasks as unknown[] | undefined)?.length ?? 0}</b>
        </div>
      </div>
    );
  }

  if (agentId === "meridian") {
    return (
      <div data-testid="office-meridian-context" style={{ marginTop: 10 }}>
        <h4>Qualificação SDR — Atividade Meridian</h4>
        <div className="kv">
          <span>ICP Aplicado</span>
          <b>{activeIcp.data?.name ?? "ICP Padrão"} v{activeIcp.data?.version ?? 1}</b>
        </div>
        {topOpp ? (
          <div style={{ margin: "6px 0", fontSize: 12 }}>
            <div>
              <b>Conta avaliada:</b> {topOpp.company?.razaoSocial ?? topOpp.companyId}
            </div>
            <div>
              Aderência ICP: <b>{topOpp.icpScore}/100</b> · Prioridade: <b>{topOpp.priority}</b>
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              <b>Fatos estruturados:</b> {topOpp.company?.reasons.join("; ") || "rubrica determinística"}
            </div>
            <div className="muted">
              <b>Inferências comerciais:</b> score {topOpp.icpScore}/100 calculado por pesos versionados
            </div>
            <div className="muted">
              <b>Recomendações:</b> {topOpp.priority === "critical" || topOpp.priority === "high" ? "Avançar abordagem outbound supervisionada" : "Nutrir conta com monitoramento periódico"}
            </div>
          </div>
        ) : (
          <p className="muted tiny">Aguardando oportunidade no pipeline para qualificação SDR.</p>
        )}
      </div>
    );
  }

  if (agentId === "beacon") {
    return (
      <div data-testid="office-beacon-context" style={{ marginTop: 10 }}>
        <h4>Prospecção Outbound — Rascunho Beacon</h4>
        <div className="kv">
          <span>Rascunhos gerados</span>
          <b>{drafts.data?.length ?? 0}</b>
        </div>
        <div className="kv">
          <span>Governança de Oferta</span>
          <b style={{ color: "var(--cyan)" }}>Apenas claims validados</b>
        </div>
        {latestDraft ? (
          <div style={{ margin: "6px 0", fontSize: 12 }}>
            <div className="mono muted">
              {latestDraft.id} · canal {latestDraft.channel} · status {latestDraft.status}
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", padding: 6, borderRadius: 6, marginTop: 4 }}>
              {latestDraft.text.slice(0, 180)}…
            </div>
            <span className="badge gold" style={{ marginTop: 4 }}>
              SIMULADO · ENVIO EXTERNO BLOQUEADO
            </span>
          </div>
        ) : (
          <p className="muted tiny">Nenhum rascunho outbound preparado ainda.</p>
        )}
      </div>
    );
  }

  if (agentId === "pledge") {
    return (
      <div data-testid="office-pledge-context" style={{ marginTop: 10 }}>
        <h4>Compromissos e Follow-up — Pledge</h4>
        <div className="kv">
          <span>Aprovações pendentes</span>
          <b>{pendingCount}</b>
        </div>
        <div className="kv">
          <span>Disparos Sandbox</span>
          <b>{dispatches.data?.total ?? 0} simulados</b>
        </div>
        <div className="kv">
          <span>Próximo follow-up</span>
          <b>{topOpp?.nextAction ?? "Revisão humana na Central de Aprovações"}</b>
        </div>
        <p className="muted tiny">
          Pledge organiza prazos, responsáveis e solicitações na Central de Aprovações sem disparo externo.
        </p>
      </div>
    );
  }

  return null;
}
