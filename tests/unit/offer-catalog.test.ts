import { describe, expect, it } from "vitest";
import {
  validateDraftClaims,
  CANONICAL_OFFER_ITEMS,
  MemoryOfferCatalogStore,
} from "@bgo/commercial";
import type { CommercialOfferItem } from "@bgo/contracts";

describe("Governança de Oferta e Claims Comerciais (G157)", () => {
  it("aprova rascunho com claims devidamente aprovados no catálogo", () => {
    const result = validateDraftClaims(["claim_val_prop_01", "claim_feat_deadlines_02"], CANONICAL_OFFER_ITEMS);
    expect(result.valid).toBe(true);
    expect(result.approvedClaims.length).toBe(2);
    expect(result.unapprovedClaims.length).toBe(0);
    expect(result.errorMessage).toBeUndefined();
  });

  it("bloqueia rascunho com claims pendentes de validação ou não existentes", () => {
    // claim_pending_unverified_07 é status 'pending_validation' no catálogo canônico
    const resultPending = validateDraftClaims(["claim_val_prop_01", "claim_pending_unverified_07"], CANONICAL_OFFER_ITEMS);
    expect(resultPending.valid).toBe(false);
    expect(resultPending.pendingClaims).toContain("claim_pending_unverified_07");
    expect(resultPending.errorMessage).toContain("pendentes de validação");

    // claim inexistente
    const resultUnknown = validateDraftClaims(["claim_inexistente_999"], CANONICAL_OFFER_ITEMS);
    expect(resultUnknown.valid).toBe(false);
    expect(resultUnknown.unapprovedClaims).toContain("claim_inexistente_999");
  });

  it("exige pelo menos um claim explícito para garantir conformidade", () => {
    const resultEmpty = validateDraftClaims([], CANONICAL_OFFER_ITEMS);
    expect(resultEmpty.valid).toBe(false);
    expect(resultEmpty.errorMessage).toContain("ao menos uma alegação aprovada vinculada");
  });

  it("permite ciclo de vida de itens de oferta com aprovação supervisionada", async () => {
    const store = new MemoryOfferCatalogStore();
    const item: CommercialOfferItem = {
      id: "offer_new_test",
      workspaceId: "ws_default",
      category: "differentiator",
      title: "Redução de Ruído com IA",
      content: "Arquitetura com zero alucinação via guardrails.",
      status: "pending_validation",
      version: "offer-v1",
      createdBy: "operator:test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.saveItem(item);

    const saved = await store.getItem(item.id);
    expect(saved?.status).toBe("pending_validation");

    // Tentativa de uso deve falhar
    const checkPending = validateDraftClaims([item.id], await store.listItems("ws_default"));
    expect(checkPending.valid).toBe(false);

    // Aprova o item
    const approved = await store.approveItem(item.id, "supervisor@bgo.local");
    expect(approved?.status).toBe("approved");

    // Agora o uso deve ser liberado
    const checkApproved = validateDraftClaims([item.id], await store.listItems("ws_default"));
    expect(checkApproved.valid).toBe(true);
  });
});
