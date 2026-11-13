const API = "/api";

let authToken: string | null = sessionStorage.getItem("bgo_token");
export function setAuthToken(t: string | null) {
  authToken = t;
  if (t) sessionStorage.setItem("bgo_token", t);
  else sessionStorage.removeItem("bgo_token");
}
export function getAuthToken() { return authToken; }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${API}${path}`, {
    headers,
    credentials: "include",
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
  company?: string;
  interest?: string;
  phone?: string;
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

export interface SessionUser { id: string; email: string; name: string; role: string }
export interface CaptureInput {
  name: string; company: string; email: string; phone?: string;
  interest: string; source: string; sourceUrl?: string;
  privacy: { noticeVersion: string; marketingOptIn: boolean; channels: string[] };
  website?: string;
}
export interface CaptureResult { leadId: string; duplicate: boolean; status: string; message: string }

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
  login: (email: string, password: string) =>
    req<{ token: string; user: SessionUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" }),
  me: () => req<{ user: SessionUser }>("/auth/me"),
  capture: (input: CaptureInput) =>
    req<CaptureResult>("/capture", { method: "POST", body: JSON.stringify(input) }),

  // ---- Onda 10: Central Scout + Custos ----
  scoutImport: (csv: string, fonte: string, filename?: string) =>
    req<{
      imported: number; duplicates: number;
      rejected: { line: number; reason: string }[];
      dossiers: { company: { cnpj: string; razaoSocial: string }; score: number }[];
      batchId?: string; persisted: { inserted: number; duplicates: number };
    }>("/scout/import", { method: "POST", body: JSON.stringify({ csv, fonte, ...(filename ? { filename } : {}) }) }),
  scoutImports: () =>
    req<{ id: string; fonte: string; imported: number; duplicates: number; rejected: number; importedBy: string; createdAt: string }[]>("/scout/imports"),
  scoutCompanies: (f?: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(f ?? {}).filter(([, v]) => v)).toString();
    return req<{ items: ScoutCompany[]; total: number; page: number; pageSize: number }>(`/scout/companies${qs ? `?${qs}` : ""}`);
  },
  scoutCompany: (id: string) =>
    req<{ company: ScoutCompany; history: { action: string; actor: string; reason?: string; occurredAt: string }[] }>(`/scout/companies/${id}`),
  scoutReview: (id: string, decision: "approved" | "rejected" | "archived", reason?: string) =>
    req<ScoutCompany>(`/scout/companies/${id}/review`, { method: "POST", body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }) }),
  scoutExportUrl: (status = "approved") => `/api/scout/export?reviewStatus=${status}`,
  costs: (f?: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(f ?? {}).filter(([, v]) => v)).toString();
    return req<CostsResponse>(`/costs${qs ? `?${qs}` : ""}`);
  },
  costsTariffs: () =>
    req<{ id: string; version: string; provider: string; model: string; inputPer1MTokens: number; outputPer1MTokens: number; active: boolean }[]>("/costs/tariffs"),
};

export interface ScoutCompany {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnae?: string;
  porte?: string;
  situacao?: string;
  municipio?: string;
  uf?: string;
  fonte: string;
  importadoEm: string;
  score: number;
  scoreVersion: string;
  reasons: string[];
  gaps: string[];
  reviewStatus: "pending" | "approved" | "rejected" | "archived";
  reviewedBy?: string;
  reviewReason?: string;
}

export interface CostsResponse {
  usage: { items: {
    id: string; missionId?: string; agentId: string; provider: string; model: string;
    simulated: boolean; tokensIn: number; tokensOut: number; costUnits: number;
    estimatedCost: number | null; billedCost: number | null; tariffVersion: string | null;
    durationMs: number; status: string; occurredAt: string;
  }[]; total: number };
  budget: {
    daily: { limit: number | null; used: number; remaining: number | null };
    monthly: { limit: number | null; used: number; remaining: number | null };
    blocked: boolean; reason?: string;
  };
  note: string;
  simulatedDisclaimer: string;
}
