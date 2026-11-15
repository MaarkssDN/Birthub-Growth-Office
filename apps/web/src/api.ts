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
  companyId?: string;
  opportunityId?: string;
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
  approverRole?: string;
  status: string;
  preview: Record<string, unknown>;
  decidedBy?: string;
  decidedAt?: string;
  decidedReason?: string;
  correlationId?: string;
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
  missionId?: string;
  occurredAt: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

export interface AuditItem {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
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

export interface ScoutCompany {
  id: string;
  batchId?: string;
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
  reviewedAt?: string;
  reviewReason?: string;
  opportunityId?: string;
  opportunityStage?: string;
}

export interface OpportunityRecord {
  id: string;
  workspaceId: string;
  companyId: string;
  leadId?: string;
  missionId?: string;
  stage: string;
  priority: "low" | "normal" | "high" | "critical";
  icpScore: number;
  currentAgentId?: string;
  nextAction?: string;
  justification: string;
  source: string;
  approvedBy: string;
  approvedAt: string;
  lostReason?: string;
  ownerId?: string;
  correlationId: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  company?: ScoutCompany;
  pendingApprovalsCount?: number;
}

export interface OpportunityHistoryRecord {
  id: string;
  opportunityId: string;
  fromStage?: string;
  toStage: string;
  action: string;
  actor: string;
  reason?: string;
  details?: Record<string, unknown>;
  correlationId: string;
  occurredAt: string;
}

export interface OpportunitiesPageResponse {
  items: OpportunityRecord[];
  total: number;
  page: number;
  pageSize: number;
  stageCounts: Record<string, number>;
  approvedCompaniesReady: ScoutCompany[];
  stageLabels: Record<string, string>;
  validTransitions: Record<string, string[]>;
}

export interface OpportunityRunRecord {
  id: string;
  missionId: string;
  agentId: string;
  status: string;
  mock: boolean;
  costUnits: number;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  correlationId: string;
  steps?: {
    id: string;
    index: number;
    tool: string;
    action: string;
    status: string;
    inputRef: string;
    outputRef?: string;
  }[];
}

export interface OpportunityDraftRecord {
  id: string;
  missionId: string;
  opportunityId?: string;
  companyId?: string;
  channel: string;
  text: string;
  claimRefs: string[];
  status: string;
  simulated: boolean;
  createdBy: string;
  createdAt: string;
}

export interface OpportunityTaskRecord {
  id: string;
  missionId: string;
  assigneeId: string;
  title: string;
  status: string;
  dependsOn: string[];
}

export interface OpportunityDetailResponse {
  opportunity: OpportunityRecord;
  company: ScoutCompany | null;
  history: OpportunityHistoryRecord[];
  companyHistory: { action: string; actor: string; reason?: string; occurredAt: string }[];
  mission: Mission | null;
  tasks: OpportunityTaskRecord[];
  runs: OpportunityRunRecord[];
  drafts: OpportunityDraftRecord[];
  approvals: Approval[];
  validTransitions: string[];
  maxDirectPriority: string;
  stageLabels: Record<string, string>;
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

export const api = {
  health: () => req<{ mode: string; simulated: boolean }>("/health"),
  agents: () => req<AgentState[]>("/agents"),
  catalog: () =>
    req<{ meta: { total: number }; personas: Persona[]; agents: CatalogAgent[] }>("/catalog"),
  leads: () => req<Lead[]>("/leads"),
  missions: () => req<(Mission & { tasks?: unknown[] })[]>("/missions"),
  mission: (id: string) => req<Mission & { runs?: OpportunityRunRecord[]; tasks?: OpportunityTaskRecord[] }>(`/missions/${id}`),
  approvals: (status = "pending", action?: string) => {
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (action) params.set("action", action);
    const qs = params.toString();
    return req<Approval[]>(`/approvals${qs ? `?${qs}` : ""}`);
  },
  requestApproval: (body: { action: string; scope?: string; reason?: string; missionId?: string; preview?: Record<string, unknown> }) =>
    req<Approval>("/approvals/request", { method: "POST", body: JSON.stringify(body) }),
  decideApproval: (id: string, decision: "approved" | "rejected", reason?: string) =>
    req<{ approval: Approval; missionStatus?: string; opportunity?: OpportunityRecord }>(`/approvals/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
    }),
  events: () => req<EventItem[]>("/events?limit=200"),
  audit: () => req<AuditItem[]>("/audit?limit=200"),
  drafts: () => req<OpportunityDraftRecord[]>("/drafts"),
  offer: () => req<{ version: string; claims: { id: string; claim: string; status: string }[] }>("/offer"),
  runDemo: () =>
    req<{ correlationId: string; approvalId: string; simulated: boolean }>("/demo/run", {
      method: "POST",
      body: "{}",
    }),
  demoStatus: () =>
    req<{ pendingApprovals: number; missions: number; leads: number; opportunities?: number; companies?: number; simulated: boolean }>("/demo/status"),
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
    req<{ company: ScoutCompany; history: { action: string; actor: string; reason?: string; occurredAt: string }[]; opportunity: OpportunityRecord | null }>(`/scout/companies/${id}`),
  scoutReview: (id: string, decision: "approved" | "rejected" | "archived", reason?: string) =>
    req<ScoutCompany>(`/scout/companies/${id}/review`, { method: "POST", body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }) }),
  scoutExportUrl: (status = "approved") => `/api/scout/export?reviewStatus=${status}`,
  costs: (f?: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(f ?? {}).filter(([, v]) => v)).toString();
    return req<CostsResponse>(`/costs${qs ? `?${qs}` : ""}`);
  },
  costsTariffs: () =>
    req<{ id: string; version: string; provider: string; model: string; currency?: string; inputPer1MTokens: number; outputPer1MTokens: number; active: boolean }[]>("/costs/tariffs"),
  addCostTariff: (body: { version: string; provider: string; model: string; currency?: string; inputPer1MTokens: number; outputPer1MTokens: number; active?: boolean }) =>
    req<{ id: string; version: string; provider: string; model: string }>("/costs/tariffs", { method: "POST", body: JSON.stringify(body) }),

  // ---- Onda 11: Empresa → Oportunidade & Pipeline Comercial ----
  promoteCompanyToOpportunity: (companyId: string, body?: { justification?: string; requireApproval?: boolean }) =>
    req<{
      opportunity?: OpportunityRecord;
      created?: boolean;
      duplicate?: boolean;
      queuedForApproval?: boolean;
      approval?: Approval;
      correlationId: string;
    }>(`/scout/companies/${companyId}/opportunity`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  opportunities: (f?: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(f ?? {}).filter(([, v]) => v)).toString();
    return req<OpportunitiesPageResponse>(`/opportunities${qs ? `?${qs}` : ""}`);
  },
  opportunity: (id: string) => req<OpportunityDetailResponse>(`/opportunities/${id}`),
  transitionOpportunity: (
    id: string,
    body: { to: string; reason?: string; requireApproval?: boolean; currentAgentId?: string; nextAction?: string },
  ) =>
    req<OpportunityRecord & { queuedForApproval?: boolean; approval?: Approval }>(`/opportunities/${id}/transition`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateOpportunityPriority: (id: string, body: { priority: string; reason?: string }) =>
    req<{
      opportunity?: OpportunityRecord;
      queuedForApproval?: boolean;
      approval?: Approval;
      rule: { allowedDirect: boolean; maxAllowed: string; reason?: string };
      correlationId: string;
    }>(`/opportunities/${id}/priority`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runOpportunityMission: (id: string, body?: { forceNew?: boolean; icpProfileId?: string }) =>
    req<{
      correlationId: string;
      opportunity: OpportunityRecord;
      mission: Mission;
      runs: OpportunityRunRecord[];
      draft: OpportunityDraftRecord;
      approval: Approval;
      qualification: {
        icpScore: number;
        recommendedPriority: string;
        evidences: string[];
        gaps: string[];
        diagnosis: string;
        simulated: boolean;
      };
      icpProfile?: { id: string; name: string; version: number };
      structuredOutput?: { facts: string[]; inferences: string[]; recommendations: string[] };
      duplicate?: boolean;
      simulated: boolean;
    }>(`/opportunities/${id}/mission`, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),

  // ---- Onda 12: ICP Dinâmico, Comunicação e Oferta Comercial ----
  listIcpProfiles: (status?: string) =>
    req<{ profiles: any[]; total: number }>(`/icp/profiles${status ? `?status=${status}` : ""}`),
  getActiveIcp: () => req<any>("/icp/active"),
  getIcpProfile: (id: string) => req<{ profile: any; history: any[] }>(`/icp/profiles/${id}`),
  createIcpProfile: (body: any) =>
    req<any>("/icp/profiles", { method: "POST", body: JSON.stringify(body) }),
  versionIcpProfile: (id: string, body: any) =>
    req<any>(`/icp/profiles/${id}/version`, { method: "POST", body: JSON.stringify(body) }),
  submitIcpApproval: (id: string) =>
    req<{ profile: any; approval: any }>(`/icp/profiles/${id}/submit-approval`, { method: "POST" }),
  compareIcp: (body: { profileAId: string; profileBId: string; companyId?: string; companyData?: any }) =>
    req<any>("/icp/compare", { method: "POST", body: JSON.stringify(body) }),

  listCommunicationDrafts: (opportunityId?: string, status?: string) => {
    const qs = new URLSearchParams();
    if (opportunityId) qs.set("opportunityId", opportunityId);
    if (status) qs.set("status", status);
    return req<{ drafts: any[]; total: number }>(`/communication/drafts${qs.toString() ? `?${qs}` : ""}`);
  },
  getCommunicationDraft: (id: string) => req<any>(`/communication/drafts/${id}`),
  dispatchCommunicationSandbox: (body: {
    channel?: string;
    recipient: string;
    subject?: string;
    content: string;
    scenario?: string;
    draftId?: string;
    opportunityId?: string;
    correlationId?: string;
  }) =>
    req<{
      dispatch: any;
      duplicated: boolean;
      simulatedPayload: { channel: string; recipientMasked: string; subject?: string; bodyLength: number; headers: Record<string, string> };
    }>("/communication/sandbox/dispatch", { method: "POST", body: JSON.stringify(body) }),
  listCommunicationDispatches: (channel?: string, status?: string) => {
    const qs = new URLSearchParams();
    if (channel) qs.set("channel", channel);
    if (status) qs.set("status", status);
    return req<{ dispatches: any[]; total: number }>(`/communication/dispatches${qs.toString() ? `?${qs}` : ""}`);
  },

  listOfferCatalog: (category?: string, status?: string) => {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (status) qs.set("status", status);
    return req<{ items: any[]; total: number }>(`/offer-catalog${qs.toString() ? `?${qs}` : ""}`);
  },
  createOfferItem: (body: { category: string; title: string; content: string; evidenceUrl?: string }) =>
    req<any>("/offer-catalog", { method: "POST", body: JSON.stringify(body) }),
  reviewOfferItem: (id: string, decision: "approved" | "rejected", reason?: string) =>
    req<any>(`/offer-catalog/${id}/review`, { method: "POST", body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }) }),
  validateOfferClaims: (claimRefs: string[]) =>
    req<{ valid: boolean; approvedClaims: any[]; unapprovedClaims: string[]; pendingClaims: string[]; errorMessage?: string }>(
      "/offer-catalog/validate",
      { method: "POST", body: JSON.stringify({ claimRefs }) },
    ),

  // ---- Onda 13: Piloto Comercial Supervisionado, Ficha Consolidada e Métricas ----
  getCommercialReadiness: () => req<any>("/commercial/readiness"),
  getConsolidatedDossier: (oppId: string) => req<any>(`/commercial/dossier/${oppId}`),
  onboardLeadOpportunity: (leadId: string, body?: { runMissionNow?: boolean; icpProfileId?: string }) =>
    req<any>(`/leads/${leadId}/onboard-opportunity`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  getPilotMetrics: () => req<any>("/metrics/pilot"),
  reviewConsolidatedDossier: (oppId: string, decision: "approved" | "rejected", reason?: string) =>
    req<any>(`/opportunities/${oppId}/dossier/review`, {
      method: "POST",
      body: JSON.stringify({ decision, ...(reason ? { reason } : {}) }),
    }),

  // ---- Onda 14: Central de Provedores de IA Real e Multiprovedor ----
  getAiProviders: () => req<any>("/ai/providers"),
  testAiProvider: (id: string) => req<any>(`/ai/providers/${id}/test`, { method: "POST" }),
  updateAiPriority: (priority: string[]) =>
    req<any>("/ai/providers/priority", { method: "POST", body: JSON.stringify({ priority }) }),
  getAiHistory: () => req<any>("/ai/history"),
  diagnoseWithAi: (body: any) =>
    req<any>("/ai/meridian-diagnose", { method: "POST", body: JSON.stringify(body) }),
  agentTask: (body: { agentId: string; input: Record<string, unknown>; missionId?: string }) =>
    req<{
      ok: boolean; simulated: boolean; agentId: string; provider: string; model: string;
      promptKey: string; promptVersion: string; output?: string;
      parsed?: Record<string, unknown>; rejectedReason?: string;
      latencyMs?: number; correlationId?: string;
    }>("/ai/agent-task", { method: "POST", body: JSON.stringify(body) }),
};
