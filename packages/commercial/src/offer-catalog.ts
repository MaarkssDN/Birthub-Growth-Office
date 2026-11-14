/**
 * Birthub Growth Office — Governança da Oferta Comercial (Onda 12 / Fase 06).
 *
 * Princípios Invioláveis:
 * 1. Base versionada de informações comercialmente aprovadas sobre a solução.
 * 2. Beacon e Meridian consultam SOMENTE alegações aprovadas (`approved`).
 * 3. Proibido inventar preços, prazos, SLAs, garantias ou cases fictícios.
 * 4. Alegações com status `pending_validation` bloqueiam o uso em abordagens externas.
 * 5. Registro imutável de data, responsável e evidência da aprovação.
 */

import type {
  CommercialOfferItem,
  OfferCategory,
  OfferItemStatus,
} from "@bgo/contracts";

export interface OfferCatalogStorePort {
  listItems(workspaceId: string, filters?: { category?: OfferCategory; status?: OfferItemStatus }): Promise<CommercialOfferItem[]>;
  getItem(id: string): Promise<CommercialOfferItem | null>;
  saveItem(item: CommercialOfferItem): Promise<void>;
  approveItem(id: string, approvedBy: string): Promise<CommercialOfferItem | null>;
  rejectItem(id: string, rejectedBy: string, reason: string): Promise<CommercialOfferItem | null>;
}

/** Catálogo Canônico Inicial com Alegações Comercial Aprovadas e Pendentes */
export const CANONICAL_OFFER_ITEMS: CommercialOfferItem[] = [
  // 1. Proposta de Valor Aprovada
  {
    id: "claim_val_prop_01",
    workspaceId: "ws_default",
    category: "value_prop",
    title: "Governança e Inteligência Integrada de Ativos",
    content: "Plataforma centralizada para gestão de ativos de propriedade intelectual e conformidade corporativa com rastreabilidade auditável.",
    evidenceUrl: "https://docs.birthub.interno/compliance/value-prop-v1.pdf",
    status: "approved",
    version: "offer-v1",
    approvedBy: "operator:head_growth",
    approvedAt: "2026-11-12T10:00:00.000Z",
    createdBy: "operator:head_growth",
    createdAt: "2026-11-12T10:00:00.000Z",
    updatedAt: "2026-11-12T10:00:00.000Z",
  },
  // 2. Funcionalidade Comprovada: Monitoramento de Prazos
  {
    id: "claim_feat_deadlines_02",
    workspaceId: "ws_default",
    category: "feature",
    title: "Monitoramento Automatizado de Prazos Legais",
    content: "Acompanhamento em tempo real de publicações oficiais e controle rigoroso de datas-limite para manifestações e renovações.",
    evidenceUrl: "https://docs.birthub.interno/features/deadlines-spec.pdf",
    status: "approved",
    version: "offer-v1",
    approvedBy: "operator:head_growth",
    approvedAt: "2026-11-12T10:00:00.000Z",
    createdBy: "operator:head_growth",
    createdAt: "2026-11-12T10:00:00.000Z",
    updatedAt: "2026-11-12T10:00:00.000Z",
  },
  // 3. Diferencial Comercial: Auditoria Append-Only
  {
    id: "claim_diff_audit_03",
    workspaceId: "ws_default",
    category: "differentiator",
    title: "Trilha de Auditoria Imutável (Append-Only)",
    content: "Todas as operações críticas e movimentações são registradas em log append-only inviolável, com correlação ponta a ponta.",
    evidenceUrl: "https://docs.birthub.interno/security/audit-whitepaper.pdf",
    status: "approved",
    version: "offer-v1",
    approvedBy: "operator:compliance_officer",
    approvedAt: "2026-11-12T11:00:00.000Z",
    createdBy: "operator:compliance_officer",
    createdAt: "2026-11-12T11:00:00.000Z",
    updatedAt: "2026-11-12T11:00:00.000Z",
  },
  // 4. Público-Alvo Aprovado
  {
    id: "claim_target_audience_04",
    workspaceId: "ws_default",
    category: "target_audience",
    title: "Escritórios de Propriedade Intelectual e Departamentos Jurídicos",
    content: "Especialmente desenhado para escritórios especializados e departamentos jurídicos de médias e grandes empresas em expansão.",
    evidenceUrl: "https://docs.birthub.interno/icp/target-audience.pdf",
    status: "approved",
    version: "offer-v1",
    approvedBy: "operator:director",
    approvedAt: "2026-11-12T11:30:00.000Z",
    createdBy: "operator:director",
    createdAt: "2026-11-12T11:30:00.000Z",
    updatedAt: "2026-11-12T11:30:00.000Z",
  },
  // 5. Condições de Contratação Autorizadas
  {
    id: "claim_contract_term_05",
    workspaceId: "ws_default",
    category: "contract_term",
    title: "Modelo de Subscrição Corporativa (SaaS)",
    content: "Contratação via assinatura anual ou plurianual com suporte técnico especializado e onboarding guiado.",
    evidenceUrl: "https://docs.birthub.interno/contracts/saas-terms-v1.pdf",
    status: "approved",
    version: "offer-v1",
    approvedBy: "operator:legal_counsel",
    approvedAt: "2026-11-12T12:00:00.000Z",
    createdBy: "operator:legal_counsel",
    createdAt: "2026-11-12T12:00:00.000Z",
    updatedAt: "2026-11-12T12:00:00.000Z",
  },
  // 6. Resposta a Objeção Aprovada: Segurança de Dados
  {
    id: "claim_obj_security_06",
    workspaceId: "ws_default",
    category: "objection_response",
    title: "Isolamento Estrito por Tenant e Criptografia",
    content: "Dados corporativos isolados logicamente com segregação de credenciais e conformidade com as diretrizes da LGPD.",
    evidenceUrl: "https://docs.birthub.interno/security/lgpd-compliance.pdf",
    status: "approved",
    version: "offer-v1",
    approvedBy: "operator:compliance_officer",
    approvedAt: "2026-11-12T12:30:00.000Z",
    createdBy: "operator:compliance_officer",
    createdAt: "2026-11-12T12:30:00.000Z",
    updatedAt: "2026-11-12T12:30:00.000Z",
  },
  // 7. Alegação PENDENTE DE VALIDAÇÃO (Bloqueia uso em abordagem comercial)
  {
    id: "claim_pending_unverified_07",
    workspaceId: "ws_default",
    category: "feature",
    title: "Integração Automática com Cartórios Extrajudiciais",
    content: "Protocolo automatizado direto em cartórios de títulos e documentos em todo o território nacional.",
    evidenceUrl: undefined,
    status: "pending_validation",
    version: "offer-v1",
    approvedBy: undefined,
    approvedAt: undefined,
    createdBy: "operator:intern",
    createdAt: "2026-11-13T09:00:00.000Z",
    updatedAt: "2026-11-13T09:00:00.000Z",
  },
];

/** In-Memory Store para testes e fallback */
export class MemoryOfferCatalogStore implements OfferCatalogStorePort {
  private items: CommercialOfferItem[] = [...CANONICAL_OFFER_ITEMS];

  async listItems(workspaceId: string, filters?: { category?: OfferCategory; status?: OfferItemStatus }): Promise<CommercialOfferItem[]> {
    return this.items.filter((item) => {
      if (item.workspaceId !== workspaceId && item.workspaceId !== "ws_default") return false;
      if (filters?.category && item.category !== filters.category) return false;
      if (filters?.status && item.status !== filters.status) return false;
      return true;
    });
  }

  async getItem(id: string): Promise<CommercialOfferItem | null> {
    return this.items.find((i) => i.id === id) ?? null;
  }

  async saveItem(item: CommercialOfferItem): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) this.items[idx] = item;
    else this.items.push(item);
  }

  async approveItem(id: string, approvedBy: string): Promise<CommercialOfferItem | null> {
    const item = await this.getItem(id);
    if (!item) return null;
    item.status = "approved";
    item.approvedBy = approvedBy;
    item.approvedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    return item;
  }

  async rejectItem(id: string, rejectedBy: string, reason: string): Promise<CommercialOfferItem | null> {
    const item = await this.getItem(id);
    if (!item) return null;
    item.status = "rejected";
    item.updatedAt = new Date().toISOString();
    return item;
  }
}

/**
 * Validador de Alegações Comerciais para Rascunhos do Beacon.
 * Garante que somente alegações com status `approved` sejam utilizadas.
 */
export function validateDraftClaims(
  claimRefs: string[],
  catalog: CommercialOfferItem[],
): {
  valid: boolean;
  approvedClaims: CommercialOfferItem[];
  unapprovedClaims: string[];
  pendingClaims: string[];
  errorMessage?: string | undefined;
} {
  if (!claimRefs || claimRefs.length === 0) {
    return {
      valid: false,
      approvedClaims: [],
      unapprovedClaims: [],
      pendingClaims: [],
      errorMessage: "Bloqueio de governança: Abordagem comercial exige ao menos uma alegação aprovada vinculada (nenhum claim informado).",
    };
  }

  const approvedClaims: CommercialOfferItem[] = [];
  const unapprovedClaims: string[] = [];
  const pendingClaims: string[] = [];

  for (const ref of claimRefs) {
    const found = catalog.find((i) => i.id === ref || i.title === ref);
    if (!found) {
      unapprovedClaims.push(ref);
    } else if (found.status === "approved") {
      approvedClaims.push(found);
    } else if (found.status === "pending_validation") {
      pendingClaims.push(ref);
    } else {
      unapprovedClaims.push(ref);
    }
  }

  const valid = unapprovedClaims.length === 0 && pendingClaims.length === 0;
  let errorMessage: string | undefined = undefined;

  if (!valid) {
    const msgs: string[] = [];
    if (pendingClaims.length > 0) {
      msgs.push(`Alegações pendentes de validação comercial: [${pendingClaims.join(", ")}]`);
    }
    if (unapprovedClaims.length > 0) {
      msgs.push(`Alegações não encontradas ou rejeitadas: [${unapprovedClaims.join(", ")}]`);
    }
    errorMessage = `Bloqueio de governança: ${msgs.join(". ")}`;
  }

  return {
    valid,
    approvedClaims,
    unapprovedClaims,
    pendingClaims,
    ...(errorMessage !== undefined ? { errorMessage } : {}),
  };
}
