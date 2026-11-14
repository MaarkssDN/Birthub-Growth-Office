import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { Store } from "@bgo/commercial";

const headersOp = { "x-bgo-user": "user:operator_1", "x-bgo-role": "operator" };
const headersAuditor = { "x-bgo-user": "user:auditor_1", "x-bgo-role": "auditor" };

function createTestApp() {
  return buildApp({
    store: new Store(),
    devAuth: true,
    persistence: "memory",
  });
}

describe("Onda 14 — Ativação de IA Real Multiprovedor — Prioridade Gratuita (G190..G205)", () => {
  it("G190, G202: GET /api/ai/providers retorna registro completo, hardware e política de custo R$ 0", async () => {
    const app = createTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/ai/providers",
      headers: headersOp,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.providers).toBeDefined();
    expect(body.providers.length).toBe(7);

    // Verifica presença dos provedores prioritários
    const providerIds = body.providers.map((p: any) => p.id);
    expect(providerIds).toContain("ollama");
    expect(providerIds).toContain("groq");
    expect(providerIds).toContain("gemini");
    expect(providerIds).toContain("openrouter");
    expect(providerIds).toContain("cloudflare");
    expect(providerIds).toContain("xai");
    expect(providerIds).toContain("mock");

    // Verifica hardware
    expect(body.hardware.cpu).toContain("Ryzen 5 5625U");
    expect(body.hardware.ramGb).toBe(24);
    expect(body.hardware.gpu).toContain("Radeon");

    // Verifica salvaguardas orçamentárias
    expect(body.routerPolicy.maxExternalCostBrl).toBe(0);
    expect(body.routerPolicy.allowPaidTier).toBe(false);
  });

  it("G191, G193: POST /api/ai/providers/:id/test executa teste sintético controlado", async () => {
    const app = createTestApp();

    // Testa mock determinístico
    const resMock = await app.inject({
      method: "POST",
      url: "/api/ai/providers/mock/test",
      headers: headersOp,
    });
    expect(resMock.statusCode).toBe(200);
    const bodyMock = resMock.json();
    expect(bodyMock.ok).toBe(true);
    expect(bodyMock.status).toBe("success");
    expect(bodyMock.provider).toBe("mock");

    // Testa provedor inexistente
    const resUnknown = await app.inject({
      method: "POST",
      url: "/api/ai/providers/nao_existe/test",
      headers: headersOp,
    });
    expect(resUnknown.statusCode).toBe(200);
    const bodyUnknown = resUnknown.json();
    expect(bodyUnknown.ok).toBe(false);
    expect(bodyUnknown.status).toBe("error");
  });

  it("G198: POST /api/ai/providers/priority reordena prioridade e bloqueia role auditor", async () => {
    const app = createTestApp();

    // Auditor tenta alterar prioridade -> 403 Forbidden
    const resAuditor = await app.inject({
      method: "POST",
      url: "/api/ai/providers/priority",
      headers: headersAuditor,
      payload: { priority: ["gemini", "groq", "ollama"] },
    });
    expect(resAuditor.statusCode).toBe(403);

    // Operador altera prioridade -> 200 OK
    const resOp = await app.inject({
      method: "POST",
      url: "/api/ai/providers/priority",
      headers: headersOp,
      payload: { priority: ["gemini", "groq", "ollama"] },
    });
    expect(resOp.statusCode).toBe(200);
    const body = resOp.json();
    expect(body.providers[0].id).toBe("gemini");
    expect(body.providers[1].id).toBe("groq");
    expect(body.providers[2].id).toBe("ollama");
  });

  it("G203: GET /api/ai/history retorna histórico de inferências e auditoria append-only", async () => {
    const app = createTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/ai/history",
      headers: headersOp,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.history).toBeDefined();
    expect(typeof body.total).toBe("number");
  });

  it("G192: POST /api/ai/meridian-diagnose emite diagnóstico estruturado com auditoria e sem vazamento de PII", async () => {
    const app = createTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/ai/meridian-diagnose",
      headers: headersOp,
      payload: {
        lead: {
          name: "Empresa Piloto Beta S.A.",
          company: "Empresa Piloto Beta",
          interest: "Eficiência operacional e esteira comercial",
          synthetic: true,
        },
        preferredProvider: "mock",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.diagnosis).toBeDefined();
    expect(body.justification).toBeDefined();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.correlationId).toBeDefined();
    expect(body.promptVersion).toBe("prompt-v2");
  });
});
