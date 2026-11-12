import type { Lead, RubricResult } from "@bgo/contracts";
import { ICP_HYPOTHESIS } from "./icp";

export const RUBRIC_VERSION = "rubric-v1";

/**
 * Rubrica versionada de qualificação (Meridian).
 * Score explicável: cada componente carrega evidência ou lacuna.
 * Nunca inventa respostas — ausência de dado vira `gaps`.
 */
export function scoreLead(lead: Lead): RubricResult {
  const components: RubricResult["components"] = [];
  const gaps: string[] = [];
  const rubric = ICP_HYPOTHESIS.scoreRubric;

  // dorDeclarada: lead sintético/demo declara dor no nome/fonte? usamos consent+source como proxy documentado
  const dorDeclarada = lead.source === "demo_form" || lead.source === "indication";
  components.push({
    key: "dorDeclarada",
    weight: rubric.dorDeclarada ?? 0,
    points: dorDeclarada ? (rubric.dorDeclarada ?? 0) : 0,
    evidence: dorDeclarada
      ? `lead originado de ${lead.source} (manifestação de interesse)`
      : "sem evidência de dor declarada",
  });
  if (!dorDeclarada) gaps.push("dor não declarada pelo lead");

  // fitIcp: sintético B2B simulado → evidência limitada
  const fitIcp = lead.synthetic; // demo: lead sintético representa conta B2B da hipótese
  components.push({
    key: "fitIcp",
    weight: rubric.fitIcp ?? 0,
    points: fitIcp ? Math.round((rubric.fitIcp ?? 0) * 0.6) : 0,
    evidence: fitIcp
      ? "lead sintético modela empresa B2B com rotina SDR/BDR (hipótese ICP, não validada)"
      : "fora da hipótese ICP",
  });
  gaps.push("fit ICP não validado com dados reais de mercado");

  // canalAutorizado
  const canalAutorizado = Boolean(lead.consent?.optIn);
  components.push({
    key: "canalAutorizado",
    weight: rubric.canalAutorizado ?? 0,
    points: canalAutorizado ? (rubric.canalAutorizado ?? 0) : 0,
    evidence: canalAutorizado
      ? `opt-in registrado em ${lead.consent?.at} para canal ${lead.consent?.channel}`
      : "sem opt-in documentado",
  });
  if (!canalAutorizado) gaps.push("opt-in ausente — contato externo permaneceria bloqueado");

  // urgenciaDeclarada
  components.push({
    key: "urgenciaDeclarada",
    weight: rubric.urgenciaDeclarada ?? 0,
    points: 0,
    evidence: "campo de urgência não coletado na Onda 00",
  });
  gaps.push("urgência não avaliada — pergunta pendente para o lead");

  // consentimento (LGPD)
  const consentimento = Boolean(lead.provenance?.legalBasis);
  components.push({
    key: "consentimento",
    weight: rubric.consentimento ?? 0,
    points: consentimento ? (rubric.consentimento ?? 0) : 0,
    evidence: `base legal declarada: ${lead.provenance.legalBasis}`,
  });
  if (!consentimento) gaps.push("base legal não declarada");

  const score = components.reduce((s, c) => s + c.points, 0);
  const recommendation =
    score >= 60 ? "qualified" : score >= 35 ? "needs_info" : "nurture";

  return {
    leadId: lead.id,
    score,
    rubricVersion: RUBRIC_VERSION,
    components,
    gaps,
    recommendation,
  };
}
