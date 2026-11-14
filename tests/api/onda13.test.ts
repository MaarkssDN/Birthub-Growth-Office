import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { Store } from "@bgo/commercial";

const headersOp = { "x-bgo-user": "user:operator_1", "x-bgo-role": "operator" };
const headersApprover = { "x-bgo-user": "user:approver_1", "x-bgo-role": "approver" };

function createTestApp() {
  return buildApp({
    store: new Store(),
    devAuth: true,
    persistence: "memory",
  });
}

describe("Onda 13 — Primeiro Piloto Comercial Supervisionado (G170-G183)", () => {
  it("G171: avalia prontidão comercial e retorna checklist de 9 categorias com status e evidências", async () => {
    const app = createTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/commercial/readiness",
      headers: headersOp,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.readyForOutreach).toBe(true);
    expect(body.readinessScore).toBe(100);
    expect(body.categories.length).toBe(9);
    expect(body.pendingClaims.length).toBeGreaterThan(0);
  });

  it("G173, G174, G175: realiza onboarding de lead voluntário e orquestra missão com os 6 agentes", async () => {
    const app = createTestApp();

    // 1. Cria lead voluntário via POST /api/leads
    const leadPayload = {
      source: "website_form",
      name: "Dr. Marcelo Vieira",
      email: "marcelo@vieira.sintetico.interno",
      company: "Vieira Contencioso Estratégico",
      synthetic: true,
      consent: {
        channel: "email",
        optIn: true,
        at: new Date().toISOString(),
      },
    };

    const leadRes = await app.inject({
      method: "POST",
      url: "/api/leads",
      headers: headersOp,
      payload: leadPayload,
    });
    expect(leadRes.statusCode).toBe(201);
    const lead = leadRes.json();

    // 2. Faz onboarding do lead para o pipeline de oportunidades executando a missão dos 6 agentes
    const onboardRes = await app.inject({
      method: "POST",
      url: `/api/leads/${lead.id}/onboard-opportunity`,
      headers: headersOp,
      payload: {
        runMissionNow: true,
      },
    });

    expect(onboardRes.statusCode).toBe(201);
    const onboard = onboardRes.json();
    expect(onboard.opportunity).toBeDefined();
    expect(onboard.company).toBeDefined();
    expect(onboard.missionResult).toBeDefined();

    // G175: Os 6 agentes participaram e geraram runs
    expect(onboard.missionResult.runs.length).toBe(6);
    const agentIds = onboard.missionResult.runs.map((r: any) => r.agentId);
    expect(agentIds).toEqual(["aegis", "relay", "scout", "meridian", "beacon", "pledge"]);

    // 3. G176: Obtém a Ficha Consolidada / Dossiê Comercial Integrado
    const dossierRes = await app.inject({
      method: "GET",
      url: `/api/commercial/dossier/${onboard.opportunity.id}`,
      headers: headersOp,
    });

    expect(dossierRes.statusCode).toBe(200);
    const dossier = dossierRes.json();
    expect(dossier.subject.company).toContain("Vieira");
    expect(dossier.structuredQualification.facts.length).toBeGreaterThan(0);
    expect(dossier.structuredQualification.inferences.length).toBeGreaterThan(0);
    expect(dossier.structuredQualification.recommendations.length).toBeGreaterThan(0);
    expect(dossier.beaconOutreach.claimValidationOk).toBe(true);

    // 4. G178/G179: Operador humano homologa preparação do dossiê (sem disparo externo)
    const reviewRes = await app.inject({
      method: "POST",
      url: `/api/opportunities/${onboard.opportunity.id}/dossier/review`,
      headers: headersApprover,
      payload: {
        decision: "approved",
        reason: "Material comercial e dossiê homologados para preparação executiva",
      },
    });

    expect(reviewRes.statusCode).toBe(200);
    const reviewBody = reviewRes.json();
    expect(reviewBody.success).toBe(true);
    expect(reviewBody.decision).toBe("approved");
    expect(reviewBody.externalSendBlocked).toBe(true);
  });

  it("G180: retorna indicadores do painel de métricas com total honestidade de estado", async () => {
    const app = createTestApp();

    const metricsRes = await app.inject({
      method: "GET",
      url: "/api/metrics/pilot",
      headers: headersOp,
    });

    expect(metricsRes.statusCode).toBe(200);
    const metrics = metricsRes.json();
    expect(metrics.meetingsHeld.count).toBe(0);
    expect(metrics.meetingsHeld.status).toBe("absent");
    expect(metrics.dataHonesty.externalDispatchesReal).toBe(false);
    expect(metrics.dataHonesty.simulated).toBe(true);
    expect(metrics.aiConsumption.mode).toBe("deterministic_g172_blocked");
  });
});
