import type { ICPProfile } from "@bgo/contracts";

/**
 * ICP — HIPÓTESE de trabalho. NÃO é evidência de mercado validada.
 * `validatedAt` permanece ausente até pesquisa real (Onda 02+).
 */
export const ICP_REVISION = "icp-hypothesis-v1";

export const ICP_HYPOTHESIS: ICPProfile = {
  id: "icp-hypothesis-v1",
  revision: ICP_REVISION,
  hypothesis: true,
  segments: [
    "empresas B2B com rotina formal de SDR/BDR",
    "times com pipeline ativo e cadências de follow-up",
    "gestores que precisam de previsibilidade de funil e métricas",
  ],
  pains: [
    "fragmentação de dados entre ferramentas comerciais",
    "baixa disciplina de follow-up",
    "ausência de visão consolidada do funil",
    "dificuldade de conectar sinais comerciais a receita",
  ],
  excludes: [
    "empresas sem processo comercial estruturado",
    "consumidor final (B2C)",
    "setores fora da hipótese inicial (a definir pelo proprietário)",
  ],
  scoreRubric: {
    dorDeclarada: 25,
    fitIcp: 25,
    canalAutorizado: 20,
    urgenciaDeclarada: 15,
    consentimento: 15,
  },
};
