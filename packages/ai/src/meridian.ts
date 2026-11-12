import type { AiGateway, CompletionResult } from "./index";

/**
 * Primeiro caso de uso real supervisionado (Onda 03 / Fase 04):
 * Meridian analisa um lead e produz diagnóstico comercial estruturado.
 *
 * Salvaguardas:
 * - Entrada sanitizada: remove e-mail/telefone/documentos do payload do modelo.
 * - Saída validada: schema estrito, confidence ∈ [0,1], claimRefs limitados
 *   aos claims aprovados passados em approvedClaims.
 * - NUNCA inventa preço/feature/SLA/case: o prompt proíbe e a validação
 *   rejeita diagnósticos que contenham padrões de promessa comercial
 *   (R$, %, "garantid", SLA numérico) fora dos claimRefs aprovados.
 * - Resultado carrega provider/model/promptVersion para auditoria.
 * - Nenhuma ação externa é disparada — diagnóstico é apenas registro.
 */

export interface LeadDiagnosisInput {
  leadId?: string;
  name?: string;
  company?: string;
  interest?: string;
  source?: string;
  status?: string;
  score?: number;
  rubricVersion?: string;
  gaps?: string[];
}

export interface CommercialDiagnosis {
  ok: boolean;
  simulated: boolean;
  provider: string;
  model: string;
  promptKey: string;
  promptVersion: string;
  diagnosis?: string;
  justification?: string;
  confidence?: number;
  nextAction?: string;
  claimRefs?: string[];
  rejectedReason?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}

/** Remove dados de contato/PII desnecessária antes de enviar ao modelo. */
export function sanitizeLeadForAi(lead: Record<string, unknown>): Record<string, unknown> {
  const { email: _e, phone: _p, whatsapp: _w, document: _d, cpf: _c, ...rest } = lead;
  return rest;
}

const FORBIDDEN_PROMISE = /(R\$\s?\d|US\$\s?\d|€\s?\d|\b\d+\s?%\s?(de\s+)?(desconto|aumento|garantia)|\bgarantid[oa]s?\b|\bSLA\b.{0,20}\d|\bcase\b.{0,30}(cliente|empresa))/i;

function parseDiagnosis(raw: string): {
  diagnosis: string; justification: string; confidence: number;
  nextAction: string; claimRefs: string[];
} | null {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const confidence = Number(obj.confidence);
    if (typeof obj.diagnosis !== "string" || typeof obj.justification !== "string") return null;
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
    return {
      diagnosis: obj.diagnosis,
      justification: obj.justification,
      confidence,
      nextAction: typeof obj.nextAction === "string" ? obj.nextAction : "",
      claimRefs: Array.isArray(obj.claimRefs) ? obj.claimRefs.filter((c): c is string => typeof c === "string") : [],
    };
  } catch {
    return null;
  }
}

export async function meridianDiagnose(
  gateway: AiGateway,
  input: LeadDiagnosisInput & { approvedClaims?: string[]; icp?: unknown },
): Promise<CommercialDiagnosis> {
  const sanitized = sanitizeLeadForAi({ ...input });
  const approvedClaims = input.approvedClaims ?? [];
  const res: CompletionResult = await gateway.complete({
    agentId: "meridian",
    promptKey: "meridian.diagnose.v1",
    promptVersion: "prompt-v2",
    input: {
      lead: sanitized,
      icp: input.icp ?? null,
      approvedClaims,
    },
    maxTokens: 800,
  });

  const base: CommercialDiagnosis = {
    ok: res.ok,
    simulated: res.simulated,
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

  const parsed = parseDiagnosis(res.output);
  if (!parsed) {
    return { ...base, rejectedReason: "saída do modelo não é JSON de diagnóstico válido" };
  }

  // bloqueio de promessas comerciais não aprovadas
  const text = `${parsed.diagnosis} ${parsed.justification} ${parsed.nextAction}`;
  if (FORBIDDEN_PROMISE.test(text)) {
    return { ...base, rejectedReason: "diagnóstico contém promessa comercial potencialmente não validada — rejeitado pela guarda de claims" };
  }
  // claimRefs fora dos aprovados → filtrados (nunca amplificados)
  const allowed = new Set(approvedClaims);
  const claimRefs = parsed.claimRefs.filter((c) => allowed.has(c));

  return {
    ...base,
    diagnosis: parsed.diagnosis,
    justification: parsed.justification,
    confidence: parsed.confidence,
    nextAction: parsed.nextAction,
    claimRefs,
  };
}
