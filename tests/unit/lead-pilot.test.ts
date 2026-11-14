import { describe, expect, it } from "vitest";
import {
  Store,
  MemoryCompanyStore,
  MemoryOpportunityStore,
  MemoryIcpStore,
  MemoryOfferCatalogStore,
  onboardVoluntaryLead,
} from "@bgo/commercial";

describe("Onda 13 / Fase 04 — Jornada de Captação e Onboarding de Lead Voluntário (G173, G174)", () => {
  function setup() {
    const store = new Store();
    const companies = new MemoryCompanyStore();
    const opportunities = new MemoryOpportunityStore(companies);
    const icpStore = new MemoryIcpStore();
    const offerCatalog = new MemoryOfferCatalogStore();

    return { store, companies, opportunities, icpStore, offerCatalog };
  }

  it("G173: faz onboarding de lead voluntário preservando consentimento, aviso de privacidade e proveniência", async () => {
    const { store, companies, opportunities, icpStore, offerCatalog } = setup();

    // 1. Cria lead com consentimento explícito e aviso de privacidade LGPD
    const leadInput = {
      source: "website_form" as const,
      name: "Dr. Alexandre Fontes",
      email: "alexandre@fontesadvocacia.sintetico.interno",
      phone: "(11) 98888-7777",
      company: "Fontes & Associados Advocacia",
      interest: "Apresentação executiva e tour 360 do módulo de monitoramento",
      synthetic: true,
      provenance: {
        source: "formulario_web_piloto",
        at: new Date().toISOString(),
        legalBasis: "consentimento_titular_art_7_I_lgpd",
      },
      consent: {
        channel: "email" as const,
        optIn: true,
        at: new Date().toISOString(),
      },
      privacy: {
        noticeVersion: "aviso_privacidade_v2026_1",
        acceptedAt: new Date().toISOString(),
        channels: ["email" as const],
        marketingOptIn: true,
      },
    };
    const lead = await store.createLead(leadInput, "visitor:landing_page");

    // 2. Executa onboarding no pipeline de oportunidades
    const result = await onboardVoluntaryLead(
      store,
      lead.id,
      "operator:growth_leader",
      {
        opportunities,
        companies,
        icpStore,
        offerCatalog,
      },
      {
        runMissionNow: true,
      },
    );

    expect(result.lead.id).toBe(lead.id);
    expect(result.opportunity).toBeDefined();
    expect(result.company).toBeDefined();
    expect(result.opportunity.companyId).toBe(result.company?.id);
    expect(result.company?.razaoSocial).toContain("Fontes & Associados");
    expect(result.opportunity.stage).toBe("awaiting_approval"); // Avançou pelas etapas da missão dos 6 agentes!
    expect(result.missionResult).toBeDefined();

    // Verifica emissão de auditoria
    const audits = await store.listAudit({ entityId: lead.id });
    expect(audits.some((a) => a.action === "lead.onboard_pilot")).toBe(true);
  });

  it("impede onboarding de lead com status suppressed / opt-out registrado", async () => {
    const { store, companies, opportunities, icpStore, offerCatalog } = setup();

    const suppressedLead = await store.createLead(
      {
        source: "website_form" as const,
        name: "Dra. Mariana Rios",
        email: "mariana@rios.interno",
        synthetic: true,
      },
      "system:optout",
    );
    await store.updateLead(suppressedLead.id, {
      status: "suppressed",
      suppressedAt: new Date().toISOString(),
    });

    await expect(
      onboardVoluntaryLead(store, suppressedLead.id, "operator:analyst", {
        opportunities,
        companies,
        icpStore,
        offerCatalog,
      }),
    ).rejects.toThrow("Lead com opt-out/suprimido não pode ingressar no pipeline comercial");
  });
});
