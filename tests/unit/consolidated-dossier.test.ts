import { describe, expect, it } from "vitest";
import {
  Store,
  MemoryCompanyStore,
  MemoryOpportunityStore,
  MemoryIcpStore,
  MemoryOfferCatalogStore,
  onboardVoluntaryLead,
  buildConsolidatedDossier,
  getPilotMetrics,
} from "@bgo/commercial";
import { ConsolidatedCommercialDossier, PilotMetricsReport } from "@bgo/contracts";

describe("Onda 13 / Fase 05 & 06 — Ficha Consolidada e Métricas do Piloto (G176, G178, G180)", () => {
  function setup() {
    const store = new Store();
    const companies = new MemoryCompanyStore();
    const opportunities = new MemoryOpportunityStore(companies);
    const icpStore = new MemoryIcpStore();
    const offerCatalog = new MemoryOfferCatalogStore();

    return { store, companies, opportunities, icpStore, offerCatalog };
  }

  it("G176, G178: constrói ficha consolidada com separação entre fatos, inferências e recomendações", async () => {
    const { store, companies, opportunities, icpStore, offerCatalog } = setup();

    const leadInput = {
      source: "website_form" as const,
      name: "Dr. Roberto Macedo",
      email: "roberto@macedo.sintetico.interno",
      company: "Macedo Sociedade de Advogados",
      synthetic: true,
      provenance: {
        source: "formulario_web",
        at: new Date().toISOString(),
        legalBasis: "consentimento_lgpd",
      },
      consent: {
        channel: "email" as const,
        optIn: true,
        at: new Date().toISOString(),
      },
      privacy: {
        noticeVersion: "aviso_v2026_1",
        acceptedAt: new Date().toISOString(),
        channels: ["email" as const],
        marketingOptIn: true,
      },
    };
    const lead = await store.createLead(leadInput, "visitor:landing");

    const onboard = await onboardVoluntaryLead(
      store,
      lead.id,
      "operator:growth",
      { opportunities, companies, icpStore, offerCatalog },
      { runMissionNow: true },
    );

    const dossier = await buildConsolidatedDossier(store, onboard.opportunity.id, {
      opportunities,
      companies,
      icpStore,
      offerCatalog,
    });

    // 1. Validação de Schema do Contrato
    const parsed = ConsolidatedCommercialDossier.safeParse(dossier);
    expect(parsed.success).toBe(true);

    // 2. G176: Diagnóstico estruturado separando fatos, inferências e recomendações
    expect(dossier.structuredQualification.facts.length).toBeGreaterThan(0);
    expect(dossier.structuredQualification.inferences.length).toBeGreaterThan(0);
    expect(dossier.structuredQualification.recommendations.length).toBeGreaterThan(0);

    // 3. G177: Rascunho com alegações homologadas
    expect(dossier.beaconOutreach.claimValidationOk).toBe(true);
    expect(dossier.beaconOutreach.approvedClaims.length).toBeGreaterThan(0);
    expect(dossier.beaconOutreach.pendingClaims.length).toBe(0);

    // 4. G178/G179: Governança com bloqueio externo estrito
    expect(dossier.governance.externalSendBlocked).toBe(true);
    expect(dossier.governance.simulated).toBe(true);
    expect(dossier.meridianDiagnosis.simulated).toBe(true);
  });

  it("G180: gera painel de métricas do piloto com estrita honestidade de estado (0 reuniões fictícias)", async () => {
    const { store, companies, opportunities, icpStore, offerCatalog } = setup();

    const metrics = await getPilotMetrics(store, {
      opportunities,
      companies,
    });

    const parsed = PilotMetricsReport.safeParse(metrics);
    expect(parsed.success).toBe(true);

    // Honestidade obrigatória: Reuniões Realizadas deve ser 0 e status absent
    expect(metrics.meetingsHeld.count).toBe(0);
    expect(metrics.meetingsHeld.status).toBe("absent");
    expect(metrics.dataHonesty.externalDispatchesReal).toBe(false);
    expect(metrics.dataHonesty.simulated).toBe(true);
    expect(metrics.aiConsumption.mode).toBe("deterministic_g172_blocked");
  });
});
