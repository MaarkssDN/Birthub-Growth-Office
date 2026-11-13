import { useMemo, useState } from "react";
import { Section } from "../views";
import { api, type Persona } from "../api";
import { useAsync } from "../hooks";
import { useOfficeEvents } from "./useOfficeEvents";
import { OfficeScene } from "./Office3D";
import type { AgentColors } from "./characters";

const STATE_LABEL: Record<string, string> = {
  idle: "ocioso", listening: "atento", processing: "processando",
  speaking: "comunicando", success: "sucesso", error: "erro",
};

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

const FALLBACK_COLORS: Record<string, AgentColors> = {  aegis: { primary: "#ffc107", secondary: "#b8860b", accent: "#ffe08a" },
  relay: { primary: "#00d4ff", secondary: "#0891b2", accent: "#7dd3fc" },
  scout: { primary: "#38bdf8", secondary: "#0369a1", accent: "#93c5fd" },
  meridian: { primary: "#a78bfa", secondary: "#6d28d9", accent: "#c4b5fd" },
  beacon: { primary: "#ff2d9b", secondary: "#be185d", accent: "#f9a8d4" },
  pledge: { primary: "#34d399", secondary: "#047857", accent: "#a7f3d0" },
};

export function OfficeView({ onOpenScout }: { onOpenScout?: () => void }) {
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
      setNotice(`Missão registrada — correlação ${r.correlationId.slice(0, 8)}. Observe os bonequinhos reagirem aos eventos reais. Aprovação pendente; nada é enviado externamente.`);
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
              <p>Use a lista de::estações abaixo — todos os recursos comerciais seguem acessíveis sem a cena 3D.</p>
            </div>
          )}
          <div className="office-hud">
            <span className={`badge ${live ? "green" : "dim"}`}>{live ? "● eventos ao vivo (SSE)" : "○ histórico"}</span>
            <span className="badge gold">SIMULAÇÃO</span>
            <button className="btn small" onClick={runDemo} disabled={running}>
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
            <div className="office-detail">
              <h3>{selAgent?.displayName ?? selected}</h3>
              <p className="muted">{selAgent?.summary ?? ""}</p>
              <div className="kv"><span>Estado</span><b className={`st-${selVisual?.state ?? "idle"}`}>{STATE_LABEL[selVisual?.state ?? "idle"]}</b></div>
              <div className="kv"><span>Estação</span><b>{selAgent?.station ?? "—"}</b></div>
              <div className="kv"><span>Autonomia</span><b>{selAgent?.autonomyCeiling ?? "—"}</b></div>
              <div className="kv"><span>Último evento</span><b className="mono tiny">{selVisual?.lastEvent ?? "—"}</b></div>
              {selVisual?.correlationId && <div className="kv"><span>Correlação</span><b className="mono tiny">{selVisual.correlationId.slice(0, 13)}…</b></div>}
              {selAgent?.visual.awaitingApproval && <span className="badge magenta">aprovação humana pendente</span>}
              {selected === "scout" && onOpenScout && (
                <ScoutPanel onOpen={onOpenScout} />
              )}
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

/** Painel Scout — empresas pendentes de revisão na Central Scout (Onda 10). */
function ScoutPanel({ onOpen }: { onOpen: () => void }) {
  const pending = useAsync(() => api.scoutCompanies({ reviewStatus: "pending", pageSize: "1" }));
  const approved = useAsync(() => api.scoutCompanies({ reviewStatus: "approved", pageSize: "1" }));
  return (
    <div className="kv" style={{ display: "block" }}>
      <div className="kv"><span>Empresas p/ revisão</span><b>{pending.data?.total ?? "—"}</b></div>
      <div className="kv"><span>Aprovadas p/ análise</span><b>{approved.data?.total ?? "—"}</b></div>
      <p className="muted tiny">Dados persistidos da Central Scout — empresa importada não é lead até aprovação humana.</p>
      <button className="btn small" onClick={onOpen}>Abrir Central Scout</button>
    </div>
  );
}
