import { describe, expect, it } from "vitest";
import {
  evaluateCommercialReadiness,
  CANONICAL_OFFER_ITEMS,
  validateDraftClaims,
  type CommercialOfferItem,
} from "@bgo/commercial";
import { CommercialReadinessReport } from "@bgo/contracts";

describe("Onda 13 / Fase 02 — Prontidão Comercial e Governança da Oferta (G171, G177)", () => {
  it("avalia o catálogo canônico e valida relatório de prontidão comercial", () => {
    const report = evaluateCommercialReadiness(CANONICAL_OFFER_ITEMS, "ws_test");

    // Validação de schema do contrato
    const parsed = CommercialReadinessReport.safeParse(report);
    expect(parsed.success).toBe(true);

    // Todas as 9 categorias devem ser avaliadas
    expect(report.categories.length).toBe(9);
    expect(report.readinessScore).toBe(100);
    expect(report.readyForOutreach).toBe(true);
    expect(report.blockingReasons.length).toBe(0);

    // Deve identificar alegações pendentes de validação
    expect(report.pendingClaims.length).toBeGreaterThanOrEqual(1);
    expect(report.pendingClaims).toContain("Garantia de Conversão Comercial de 80% em 30 Dias");
  });

  it("bloqueia prontidão comercial se uma categoria mandatória não possuir item aprovado com evidência", () => {
    // Catálogo parcial sem roteiro de demonstração
    const partialCatalog = CANONICAL_OFFER_ITEMS.filter((i) => i.category !== "demo_script");
    const report = evaluateCommercialReadiness(partialCatalog, "ws_test");

    expect(report.readyForOutreach).toBe(false);
    expect(report.readinessScore).toBeLessThan(100);
    expect(report.blockingReasons.length).toBeGreaterThan(0);
    expect(report.blockingReasons[0]).toContain("Roteiros de Demonstração Homologados");
  });

  it("bloqueia categoria se item aprovado não possuir URL de evidência documental", () => {
    const customCatalog: CommercialOfferItem[] = [
      ...CANONICAL_OFFER_ITEMS.filter((i) => i.category !== "demo_script"),
      {
        id: "demo_unverified",
        workspaceId: "ws_test",
        category: "demo_script",
        title: "Roteiro sem Evidência",
        content: "Demonstração rápida",
        evidenceUrl: undefined, // Sem URL de evidência
        status: "approved",
        version: "v1",
        createdBy: "op",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const report = evaluateCommercialReadiness(customCatalog, "ws_test");
    expect(report.readyForOutreach).toBe(false);
    expect(report.blockingReasons).toContain(
      "Categoria 'Roteiros de Demonstração Homologados' não possui nenhum item aprovado com evidência documental verificável.",
    );
  });

  it("G177: impede que rascunho de abordagem utilize alegações não verificadas ou pendentes", () => {
    const unapprovedRefs = ["claim_pending_unverified_guarantee_11", "claim_inexistente_99"];
    const val = validateDraftClaims(unapprovedRefs, CANONICAL_OFFER_ITEMS);

    expect(val.valid).toBe(false);
    expect(val.errorMessage).toBeDefined();
    expect(val.pendingClaims).toContain("claim_pending_unverified_guarantee_11");
    expect(val.unapprovedClaims).toContain("claim_inexistente_99");
  });

  it("G177: aprova rascunho contendo estritamente alegações aprovadas com evidência", () => {
    const approvedRefs = ["claim_val_prop_01", "claim_feat_deadlines_02", "claim_demo_script_07"];
    const val = validateDraftClaims(approvedRefs, CANONICAL_OFFER_ITEMS);

    expect(val.valid).toBe(true);
    expect(val.errorMessage).toBeUndefined();
    expect(val.approvedClaims.length).toBe(3);
    expect(val.pendingClaims.length).toBe(0);
    expect(val.unapprovedClaims.length).toBe(0);
  });
});
