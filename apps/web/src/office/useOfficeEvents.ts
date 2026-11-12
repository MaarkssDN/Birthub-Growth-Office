import { useEffect, useMemo, useRef, useState } from "react";
import { api, type EventItem } from "../api";
import type { VisualState } from "@bgo/contracts";

/**
 * Estado reativo do escritório: deriva estados visuais SOMENTE de eventos
 * reais emitidos pela API (SSE /api/events/stream + polling de /api/events
 * para histórico e fallback). Nenhum estado é inventado.
 */

export interface AgentVisual {
  state: VisualState;
  at: string;
  lastEvent?: string;
  correlationId?: string;
}

const IDLE_MS = 7000;

/** Mapeia evento real → estado visual do agente dono do evento. */
export function eventToVisualState(e: EventItem): { agentId: string; state: VisualState } | null {
  const agentId = e.agentId;
  if (!agentId) return null;
  switch (e.eventType) {
    case "run.started.v1":
    case "run.step.completed.v1":
      return { agentId, state: "processing" };
    case "mission.assigned.v1":
      return { agentId, state: "listening" };
    case "draft.created.v1":
    case "approval.requested.v1":
      return { agentId, state: "speaking" };
    case "lead.qualified.v1":
    case "run.completed.v1":
    case "approval.decided.v1":
    case "draft.decided.v1":
      return { agentId, state: "success" };
    case "run.failed.v1":
    case "audit.denied.v1":
      return { agentId, state: "error" };
    case "mission.status_changed.v1": {
      const to = String(e.payload?.to ?? "");
      if (to === "awaiting_approval") return { agentId, state: "listening" };
      if (to === "completed") return { agentId, state: "success" };
      if (to === "cancelled" || to === "failed") return { agentId, state: "error" };
      return null;
    }
    default:
      return null;
  }
}

const SIX = ["aegis", "relay", "scout", "meridian", "beacon", "pledge"] as const;

export function useOfficeEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [live, setLive] = useState(false);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [agentVisuals, setAgentVisuals] = useState<Record<string, AgentVisual>>(() =>
    Object.fromEntries(SIX.map((id) => [id, { state: "idle" as VisualState, at: "" }])),
  );

  const applyEvent = (e: EventItem) => {
    setEvents((prev) => {
      if (prev.some((x) => x.eventId === e.eventId)) return prev;
      return [...prev.slice(-299), e];
    });
    const mapped = eventToVisualState(e);
    if (!mapped) return;
    const key = mapped.agentId;
    setAgentVisuals((prev) => ({
      ...prev,
      [key]: { state: mapped.state, at: e.occurredAt, lastEvent: e.eventType, correlationId: e.correlationId },
    }));
    const old = timers.current.get(key);
    if (old) clearTimeout(old);
    timers.current.set(
      key,
      setTimeout(() => {
        setAgentVisuals((prev) =>
          prev[key]?.at === e.occurredAt ? { ...prev, [key]: { ...prev[key]!, state: "idle", at: e.occurredAt } } : prev,
        );
      }, IDLE_MS),
    );
  };

  useEffect(() => {
    let disposed = false;
    api.events().then((list) => {
      if (disposed) return;
      // replay cronológico só para derivar estados atuais (sem animar histórico)
      for (const e of list.slice(-80)) applyEvent(e);
    }).catch(() => undefined);

    const types = [
      "run.started.v1", "run.step.completed.v1", "mission.assigned.v1",
      "draft.created.v1", "approval.requested.v1", "lead.qualified.v1",
      "run.completed.v1", "approval.decided.v1", "draft.decided.v1",
      "run.failed.v1", "audit.denied.v1", "mission.status_changed.v1",
      "lead.created.v1",
    ];
    const es = new EventSource("/api/events/stream");
    const onAny = (ev: MessageEvent) => {
      try {
        applyEvent(JSON.parse(ev.data) as EventItem);
      } catch { /* payload inválido ignorado */ }
    };
    for (const t of types) es.addEventListener(t, onAny);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    return () => {
      disposed = true;
      es.close();
      for (const t of timers.current.values()) clearTimeout(t);
    };
  }, []);

  const agents = useMemo(() => SIX.map((id) => ({ id, visual: agentVisuals[id] ?? { state: "idle" as VisualState, at: "" } })), [agentVisuals]);
  return { events, agents, live };
}
