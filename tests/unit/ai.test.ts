import { describe, expect, it, afterEach } from "vitest";
import http from "node:http";
import { AiGateway, meridianDiagnose, type CompletionRequest } from "@bgo/ai";

const cleanEnv = () => {
  delete process.env.BGO_AI_MODE;
  delete process.env.BGO_AI_ENABLED;
  delete process.env.BGO_AI_API_KEY;
  delete process.env.BGO_AI_BASE_URL;
};

afterEach(cleanEnv);

describe("AI gateway (G33)", () => {
  it("default é simulated — nunca real sem 3 flags", async () => {
    const gw = new AiGateway({});
    expect(gw.status().mode).toBe("simulated");
    const r = await gw.complete({ agentId: "meridian", promptKey: "meridian.diagnose.v1", promptVersion: "prompt-v2", input: {} });
    expect(r.simulated).toBe(true);
    expect(r.provider).toBe("mock");
  });

  it("modo disabled retorna erro explícito", async () => {
    const gw = new AiGateway({ BGO_AI_MODE: "disabled" });
    const r = await gw.complete({ agentId: "x", promptKey: "k", promptVersion: "v", input: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("desabilitada");
  });

  it("limite de chamadas por run é enforce", async () => {
    const gw = new AiGateway({}, { maxCallsPerRun: 2 });
    const req: CompletionRequest = { agentId: "x", promptKey: "k", promptVersion: "v", input: {} };
    await gw.complete(req);
    await gw.complete(req);
    const r3 = await gw.complete(req);
    expect(r3.ok).toBe(false);
    expect(r3.error).toContain("limite");
  });

  it("provider real via stub OpenAI-compatible: saída validada e modelo registrado", async () => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            diagnosis: "fit moderado", justification: "sinais públicos alinhados",
            confidence: 0.6, nextAction: "agendar conversa", claimRefs: ["claim-name"],
          }) } }],
          usage: { prompt_tokens: 120, completion_tokens: 40 },
        }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    try {
      const gw = new AiGateway({
        BGO_AI_MODE: "real", BGO_AI_ENABLED: "1", BGO_AI_API_KEY: "test-key",
        BGO_AI_BASE_URL: `http://127.0.0.1:${port}/v1`, BGO_AI_MODEL: "stub-model-1",
      });
      expect(gw.status().mode).toBe("real");
      const d = await meridianDiagnose(gw, {
        leadId: "L1", name: "Teste", company: "ACME", approvedClaims: ["claim-name"],
      });
      expect(d.ok).toBe(true);
      expect(d.simulated).toBe(false);
      expect(d.model).toBe("stub-model-1");
      expect(d.provider).toBe("openai-compatible");
      expect(d.diagnosis).toBe("fit moderado");
      expect(d.claimRefs).toEqual(["claim-name"]);
      expect(d.tokensIn ?? 0).toBeGreaterThan(0);
    } finally {
      server.close();
    }
  });

  it("guarda de claims: diagnóstico com promessa não aprovada é rejeitado", async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          diagnosis: "ótimo lead", justification: "oferecer 20% de desconto garantido",
          confidence: 0.9, nextAction: "fechar com SLA de 7 dias", claimRefs: ["claim-fake"],
        }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    try {
      const gw = new AiGateway({
        BGO_AI_MODE: "real", BGO_AI_ENABLED: "1", BGO_AI_API_KEY: "k",
        BGO_AI_BASE_URL: `http://127.0.0.1:${port}`, BGO_AI_MODEL: "m",
      });
      const d = await meridianDiagnose(gw, { approvedClaims: ["claim-name"] });
      expect(d.ok).toBe(true); // chamada ok, mas...
      expect(d.diagnosis).toBeUndefined();
      expect(d.rejectedReason).toContain("promessa comercial");
    } finally {
      server.close();
    }
  });

  it("diagnóstico simulated vem marcado e schema-válido", async () => {
    const gw = new AiGateway({});
    const d = await meridianDiagnose(gw, { name: "Lead", approvedClaims: [] });
    expect(d.ok).toBe(true);
    expect(d.simulated).toBe(true);
    expect(d.confidence).toBe(0.4);
    expect(d.diagnosis).toContain("SIMULADO");
  });
});
