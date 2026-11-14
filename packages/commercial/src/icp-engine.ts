/**
 * Birthub Growth Office — Motor de ICP Dinâmico e Versionado (Onda 12 / Fase 02).
 *
 * Princípios:
 * 1. Substitui critérios estáticos por perfis configuráveis, versionados e auditáveis.
 * 2. Scout e Meridian utilizam a mesma versão aprovada do ICP para classificar empresas e oportunidades.
 * 3. Classificações históricas preservam a versão original utilizada (icpProfileId + icpVersion).
 * 4. Pontuação NUNCA é apresentada como evidência ou garantia de intenção de compra.
 * 5. Toda nova versão ou alteração de regras requer aprovação humana prévia para ativação.
 */

import type {
  CommercialIcpProfile,
  IcpInclusionRule,
  IcpExclusionRule,
  IcpWeights,
} from "@bgo/contracts";

export interface CompanyEvaluationSubject {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnae?: string | null;
  porte?: string | null;
  situacao?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

export interface IcpEvaluationResult {
  score: number; // 0 a 100
  excluded: boolean;
  exclusionReason?: string;
  reasons: string[];
  gaps: string[];
  icpProfileId: string;
  icpProfileName: string;
  icpVersion: number;
  disclaimer: string;
}

export interface IcpComparisonResult {
  company: { cnpj: string; razaoSocial: string };
  profileA: { id: string; name: string; version: number; score: number; excluded: boolean };
  profileB: { id: string; name: string; version: number; score: number; excluded: boolean };
  scoreDifference: number; // scoreB - scoreA
  reasonsAdded: string[];
  reasonsRemoved: string[];
  gapsAdded: string[];
  gapsRemoved: string[];
}

/** Perfil Canônico Padrão (Hipótese de Prospecção B2B Tech / SaaS) */
export const DEFAULT_COMMERCIAL_ICP_PROFILE: CommercialIcpProfile = {
  id: "icp_default_saas_tech",
  workspaceId: "ws_default",
  name: "B2B Tecnologia & Serviços Especializados",
  version: 1,
  status: "approved",
  description: "Perfil voltado a empresas de software, tecnologia e consultoria com estrutura comercial ativa.",
  targetSegments: ["Tecnologia da Informação", "Consultoria em Gestão", "Serviços Especializados"],
  targetCnaes: [
    "62.01-5-01", // Desenvolvimento de software sob encomenda
    "62.02-3-00", // Desenvolvimento e licenciamento de programas customizáveis
    "62.04-0-00", // Consultoria em TI
    "62.09-1-00", // Suporte técnico e manutenção em TI
    "70.20-4-00", // Consultoria em gestão empresarial
  ],
  targetSizes: ["EPP", "MEDIO", "GRANDE", "DEMAIS"],
  targetUfs: ["SP", "RJ", "MG", "PR", "SC", "RS"],
  inclusions: [
    {
      id: "inc_active_status",
      name: "Situação Cadastral Ativa",
      weight: 25,
      condition: "situacao_ativa",
    },
    {
      id: "inc_target_size",
      name: "Porte com Capacidade Comercial",
      weight: 25,
      condition: "porte_alvo",
    },
    {
      id: "inc_target_cnae",
      name: "CNAE Primário de Tecnologia/Gestão",
      weight: 30,
      condition: "cnae_alvo",
    },
    {
      id: "inc_priority_region",
      name: "Localização em Polo Econômico (Sul/Sudeste)",
      weight: 15,
      condition: "uf_alvo",
    },
    {
      id: "inc_has_tradename",
      name: "Nome Fantasia Informado",
      weight: 5,
      condition: "tem_fantasia",
    },
  ],
  exclusions: [
    {
      id: "exc_inactive",
      name: "Empresa Inativa ou Baixada",
      condition: "situacao_inativa",
      reason: "Empresa com situação cadastral inapta, suspensa ou baixada na Receita Federal.",
    },
    {
      id: "exc_mei",
      name: "Microempreendedor Individual",
      condition: "porte_mei",
      reason: "MEI não atende aos requisitos mínimos de equipe comercial e volume de prospecção do Growth Office.",
    },
  ],
  weights: {
    cnae: 30,
    size: 25,
    location: 20,
    operation: 25,
  },
  changeReason: "Perfil canônico aprovado para operação integrada Onda 12.",
  approvedBy: "operator:director",
  approvedAt: "2026-11-13T00:00:00.000Z",
  createdBy: "system:meridian",
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
};

const DISCLAIMER_TEXT =
  "Pontuação heurística de aderência ao ICP. Não representa prova nem garantia de intenção de compra.";

/**
 * Avalia uma empresa contra um perfil de ICP dinâmico.
 */
export function evaluateCompanyIcp(
  company: CompanyEvaluationSubject,
  profile: CommercialIcpProfile = DEFAULT_COMMERCIAL_ICP_PROFILE,
): IcpEvaluationResult {
  const reasons: string[] = [];
  const gaps: string[] = [];

  const sit = (company.situacao ?? "").toUpperCase();
  const porte = (company.porte ?? "").toUpperCase();
  const cnae = (company.cnae ?? "").replace(/[^\d]/g, "");
  const uf = (company.uf ?? "").toUpperCase();

  // 1. Verificação de Regras de Exclusão
  for (const exc of profile.exclusions) {
    if (exc.condition === "situacao_inativa") {
      if (sit && !sit.includes("ATIVA")) {
        return {
          score: 0,
          excluded: true,
          exclusionReason: exc.reason,
          reasons: [`Desqualificada: ${exc.name} (${exc.reason})`],
          gaps: ["Situação cadastral não ativa"],
          icpProfileId: profile.id,
          icpProfileName: profile.name,
          icpVersion: profile.version,
          disclaimer: DISCLAIMER_TEXT,
        };
      }
    }
    if (exc.condition === "porte_mei") {
      if (porte === "MEI") {
        return {
          score: 0,
          excluded: true,
          exclusionReason: exc.reason,
          reasons: [`Desqualificada: ${exc.name} (${exc.reason})`],
          gaps: ["Porte MEI incompatível com solução"],
          icpProfileId: profile.id,
          icpProfileName: profile.name,
          icpVersion: profile.version,
          disclaimer: DISCLAIMER_TEXT,
        };
      }
    }
  }

  // 2. Pontuação por Critérios de Inclusão e Pesos
  let totalPoints = 0;
  let maxPossiblePoints = 0;

  // A. Situação Cadastral (Operação)
  const weightOp = profile.weights.operation || 25;
  maxPossiblePoints += weightOp;
  if (sit.includes("ATIVA")) {
    totalPoints += weightOp;
    reasons.push("Situação cadastral regular e ativa");
  } else if (!sit) {
    gaps.push("Situação cadastral não informada");
  } else {
    gaps.push(`Situação cadastral atípica: ${sit}`);
  }

  // B. Porte da Empresa
  const weightSize = profile.weights.size || 25;
  maxPossiblePoints += weightSize;
  const targetSizesUpper = profile.targetSizes.map((s) => s.toUpperCase());
  if (porte && targetSizesUpper.some((ts) => porte.includes(ts))) {
    totalPoints += weightSize;
    reasons.push(`Porte aderente (${porte}) com estrutura comercial provável`);
  } else if (porte) {
    totalPoints += Math.round(weightSize * 0.4);
    reasons.push(`Porte identificado: ${porte}`);
  } else {
    gaps.push("Porte empresarial não informado");
  }

  // C. Segmento / CNAE
  const weightCnae = profile.weights.cnae || 30;
  maxPossiblePoints += weightCnae;
  if (company.cnae) {
    const rawCnae = company.cnae;
    const matchesCnae = profile.targetCnaes.some((tc) => {
      const cleanTc = tc.replace(/[^\d]/g, "");
      return cnae.startsWith(cleanTc) || cleanTc.startsWith(cnae);
    });
    if (matchesCnae) {
      totalPoints += weightCnae;
      reasons.push(`CNAE ${rawCnae} alinhado aos setores prioritários do perfil`);
    } else {
      totalPoints += Math.round(weightCnae * 0.3);
      reasons.push(`CNAE ${rawCnae} correlato`);
    }
  } else {
    gaps.push("CNAE ausente — setor não verificável");
  }

  // D. Localização / UF
  const weightLoc = profile.weights.location || 20;
  maxPossiblePoints += weightLoc;
  if (uf && profile.targetUfs.map((u) => u.toUpperCase()).includes(uf)) {
    totalPoints += weightLoc;
    reasons.push(`Localização em polo prioritário (${company.municipio ? company.municipio + "/" : ""}${uf})`);
  } else if (uf) {
    totalPoints += Math.round(weightLoc * 0.5);
    reasons.push(`Localização atendida em território nacional (${uf})`);
  } else {
    gaps.push("Unidade Federativa (UF) ausente");
  }

  // E. Nome Fantasia (Validação Cadastral Adicional)
  if (!company.nomeFantasia) {
    gaps.push("Nome fantasia não preenchido");
  }

  // Normalização final em escala 0 a 100
  const normalizedScore = maxPossiblePoints > 0
    ? Math.min(100, Math.max(0, Math.round((totalPoints / maxPossiblePoints) * 100)))
    : 0;

  return {
    score: normalizedScore,
    excluded: false,
    reasons,
    gaps,
    icpProfileId: profile.id,
    icpProfileName: profile.name,
    icpVersion: profile.version,
    disclaimer: DISCLAIMER_TEXT,
  };
}

/**
 * Compara a avaliação de uma empresa entre duas versões ou perfis de ICP.
 */
export function compareIcpEvaluation(
  company: CompanyEvaluationSubject,
  profileA: CommercialIcpProfile,
  profileB: CommercialIcpProfile,
): IcpComparisonResult {
  const resA = evaluateCompanyIcp(company, profileA);
  const resB = evaluateCompanyIcp(company, profileB);

  const setA_reasons = new Set(resA.reasons);
  const setB_reasons = new Set(resB.reasons);
  const setA_gaps = new Set(resA.gaps);
  const setB_gaps = new Set(resB.gaps);

  const reasonsAdded = resB.reasons.filter((r) => !setA_reasons.has(r));
  const reasonsRemoved = resA.reasons.filter((r) => !setB_reasons.has(r));
  const gapsAdded = resB.gaps.filter((g) => !setA_gaps.has(g));
  const gapsRemoved = resA.gaps.filter((g) => !setB_gaps.has(g));

  return {
    company: { cnpj: company.cnpj, razaoSocial: company.razaoSocial },
    profileA: {
      id: profileA.id,
      name: profileA.name,
      version: profileA.version,
      score: resA.score,
      excluded: resA.excluded,
    },
    profileB: {
      id: profileB.id,
      name: profileB.name,
      version: profileB.version,
      score: resB.score,
      excluded: resB.excluded,
    },
    scoreDifference: resB.score - resA.score,
    reasonsAdded,
    reasonsRemoved,
    gapsAdded,
    gapsRemoved,
  };
}
