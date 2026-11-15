import type { AiGateway, CompletionResult } from "./index";

/**
 * Casos de uso supervisionados dos 5 agentes restantes (Onda 15).
 * Mesmo contrato do Meridian: entrada sanitizada, saída validada por schema,
 * guarda anti-promoções, provider/model/promptVersion auditáveis.
 * Nada aqui dispara ação externa — resultados são registros para revisão humana.
 */

export type AgentTaskId = "scout" | "beacon" | "relay" | "pledge" | "aegis";

const TASK_PROMPT: Record<AgentTaskId, { promptKey: string; promptVersion: string; expectsJson: boolean }> = {
  scout: { promptKey: "scout.research.v1", promptVersion: "prompt-v1", expectsJson: true },
  beacon: { promptKey: "beacon.draft.v1", promptVersion: "prompt-v1", expectsJson: false },
  relay: { promptKey: "relay.plan.v1", promptVersion: "prompt-v1", expectsJson: true },
  pledge: { promptKey: "pledge.followup.v1", promptVersion: "prompt-v1", expectsJson: true },
  aegis: { promptKey: "aegis.supervise.v1", promptVersion: "prompt-v1", expectsJson: true },
};

export interface AgentTaskResult {
  ok: boolean;
  simulated: boolean;
  agentId: AgentTaskId;
  provider: string;
  model: string;
  promptKey: string;
  promptVersion: string;
  output?: string;
  parsed?: Record<string, unknown>;
  rejectedReason?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}

const FORBIDDEN_PROMISE = /(R\$\s?\d|US\$\s?\d|€\s?\d|\b\d+\s?%\s?(de\s+)?(desconto|aumento|garantia)|\bgarantid[oa]s?\b|\bSLA\b.{0,20}\d|\bcase\b.{0,30}(cliente|empresa))/i;

/** Remove PII desnecessária antes de enviar ao modelo. */
export function sanitizeForAi(input: Record<string, unknown>): Record<string, unknown> {
  const { email: _e, phone: _p, whatsapp: _w, document: _d, cpf: _c, ...rest } = input;
  return rest;
}

function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(raw.slice(start, end + 1)) as unknown;
    return typeof obj === "object" && obj !== null ? (obj as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Valida campos mínimos esperados por agente. */
function schemaOk(agent: AgentTaskId, obj: Record<string, unknown>): boolean {
  switch (agent) {
    case "scout":
      return Array.isArray(obj.sources) || Array.isArray(obj.signals);
    case "relay":
      return Array.isArray(obj.steps);
    case "pledge":
      return typeof obj.commitment === "string" || typeof obj.remindAt === "string";
    case "aegis":
      return Array.isArray(obj.risks) || Array.isArray(obj.approvalsNeeded);
    case "beacon":
      return true; // saída textual
  }
}

export async function agentTask(
  gateway: AiGateway,
  opts: {
    agentId: AgentTaskId;
    input: Record<string, unknown>;
    missionId?: string;
    correlationId?: string;
    approvedClaims?: string[];
    maxTokens?: number;
  },
): Promise<AgentTaskResult> {
  const task = TASK_PROMPT[opts.agentId];
  const res: CompletionResult = await gateway.complete({
    agentId: opts.agentId,
    promptKey: task.promptKey,
    promptVersion: task.promptVersion,
    input: sanitizeForAi(opts.input),
    ...(opts.maxTokens !== undefined ? { maxTokens: opts.maxTokens } : { maxTokens: 800 }),
    ...(opts.missionId !== undefined ? { missionId: opts.missionId } : {}),
    ...(opts.correlationId !== undefined ? { correlationId: opts.correlationId } : {}),
  });

  const base: AgentTaskResult = {
    ok: res.ok,
    simulated: res.simulated,
    agentId: opts.agentId,
    provider: res.provider,
    model: res.model,
    promptKey: res.promptKey,
    promptVersion: res.promptVersion,
    ...(res.latencyMs !== undefined ? { latencyMs: res.latencyMs } : {}),
    ...(res.tokensIn !== undefined ? { tokensIn: res.tokensIn } : {}),
    ...(res.tokensOut !== undefined ? { tokensOut: res.tokensOut } : {}),
  };
  if (!res.ok || !res.output) {
    return { ...base, rejectedReason: res.error ?? "sem saída do provedor" };
  }

  const text = res.output;
  // Guarda anti-promoções em qualquer saída voltada a cliente (Beacon) ou estruturada.
  if (FORBIDDEN_PROMISE.test(text)) {
    return { ...base, output: text, rejectedReason: "saída contém promessa comercial potencialmente não validada — rejeitada pela guarda de claims" };
  }

  if (!task.expectsJson) {
    return { ...base, output: text };
  }

  const parsed = extractJson(text);
  if (!parsed || !schemaOk(opts.agentId, parsed)) {
    return {
      ...base,
      output: text,
      rejectedReason: res.simulated
        ? "saída simulada não atende ao schema do agente — esperado em modo SIMULADO"
        : "saída do modelo não é JSON válido para o schema do agente",
    };
  }
  return { ...base, output: text, parsed };
}
