const API = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Lead {
  id: string;
  source: string;
  status: string;
  name?: string;
  email?: string;
  synthetic: boolean;
  capturedAt: string;
  createdBy: string;
}

export interface Mission {
  id: string;
  goal: string;
  status: string;
  leadId?: string;
  correlationId: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  missionId: string;
  action: string;
  scope: string;
  reason: string;
  requestedBy: string;
  status: string;
  preview: Record<string, unknown>;
  createdAt: string;
}

export interface CatalogAgent {
  agentId: string;
  displayName: string;
  layer: string;
  active: boolean;
  autonomyCeiling: string;
  implementationStatus: string;
  station?: string;
  summary?: string;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  layerName: string;
  mvp: boolean;
  colors: { primary: string; secondary: string; accent: string };
  statusTexto?: string;
  limiteDocumentado?: string;
}

export interface AgentState extends CatalogAgent {
  visual: { state: string; awaitingApproval: boolean; simulated: boolean };
}

export interface EventItem {
  eventId: string;
  eventType: string;
  agentId?: string;
  occurredAt: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

export interface AuditItem {
  id: string;
  actor: string;
  action: string;
  entity: string;
  outcome: string;
  occurredAt: string;
  correlationId: string;
}

export const api = {
  health: () => req<{ mode: string; simulated: boolean }>("/health"),
  agents: () => req<AgentState[]>("/agents"),
  catalog: () =>
    req<{ meta: { total: number }; personas: Persona[]; agents: CatalogAgent[] }>("/catalog"),
  leads: () => req<Lead[]>("/leads"),
  missions: () => req<(Mission & { tasks?: unknown[] })[]>("/missions"),
  mission: (id: string) => req<Mission & { runs?: { agentId: string; status: string; mock: boolean }[] }>(`/missions/${id}`),
  approvals: (status = "pending") => req<Approval[]>(`/approvals?status=${status}`),
  decideApproval: (id: string, decision: "approved" | "rejected", reason?: string) =>
    req<{ approval: Approval; missionStatus: string }>(`/approvals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
    }),
  events: () => req<EventItem[]>("/events?limit=200"),
  audit: () => req<AuditItem[]>("/audit?limit=200"),
  drafts: () => req<{ id: string; channel: string; status: string; simulated: boolean; text: string }[]>("/drafts"),
  offer: () => req<{ version: string; claims: { id: string; claim: string; status: string }[] }>("/offer"),
  runDemo: () =>
    req<{ correlationId: string; approvalId: string; simulated: boolean }>("/demo/run", {
      method: "POST",
      body: "{}",
    }),
  demoStatus: () => req<{ pendingApprovals: number; missions: number; leads: number; simulated: boolean }>("/demo/status"),
};
