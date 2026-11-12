import type { OfferClaim } from "@bgo/contracts";

/**
 * Catálogo de claims comerciais — verdade antes do marketing.
 * Somente `status: "approved"` pode ser referenciado por rascunhos (Beacon).
 * Claims de feature/preço/SLA permanecem PENDENTE_DE_VALIDACAO até o
 * proprietário do produto comprovar.
 */
export const OFFER_VERSION = "offer-v1";

export const OFFER_CLAIMS: OfferClaim[] = [
  {
    id: "claim-name",
    claim: "O produto comercializado é o Birthub 360°.",
    status: "approved",
    version: OFFER_VERSION,
    approvedBy: "documento-mestre-v1",
  },
  {
    id: "claim-positioning",
    claim: "Posicionamento proposto: plataforma comercial unificada para operação SDR/BDR.",
    status: "pending",
    version: OFFER_VERSION,
  },
  {
    id: "claim-modules",
    claim: "Módulos disponíveis hoje no Birthub 360°.",
    status: "pending",
    version: OFFER_VERSION,
  },
  {
    id: "claim-pricing",
    claim: "Preços, planos, descontos e trials do Birthub 360°.",
    status: "pending",
    version: OFFER_VERSION,
  },
  {
    id: "claim-integrations",
    claim: "Integrações e automações disponíveis no Birthub 360°.",
    status: "pending",
    version: OFFER_VERSION,
  },
  {
    id: "claim-results",
    claim: "Números de resultado, ROI e depoimentos de clientes.",
    status: "pending",
    version: OFFER_VERSION,
  },
  {
    id: "claim-sla",
    claim: "Tempo de implantação, suporte e SLA do Birthub 360°.",
    status: "pending",
    version: OFFER_VERSION,
  },
  {
    id: "claim-ai",
    claim: "Recursos de IA, WhatsApp e telefonia do Birthub 360°.",
    status: "pending",
    version: OFFER_VERSION,
  },
];

export function approvedClaimIds(): string[] {
  return OFFER_CLAIMS.filter((c) => c.status === "approved").map((c) => c.id);
}

export function claimIsApproved(id: string): boolean {
  return OFFER_CLAIMS.some((c) => c.id === id && c.status === "approved");
}

export function claimsForDraft(): { id: string; claim: string }[] {
  return OFFER_CLAIMS.filter((c) => c.status === "approved").map((c) => ({
    id: c.id,
    claim: c.claim,
  }));
}
