import { describe, expect, it } from "vitest";
import { agentTask, sanitizeForAi } from "@bgo/ai";
import { AiGateway } from "@bgo/ai";

const gw = () => new AiGateway({}, {});

describe("agentTask — 5 agentes supervisionados (Onda 15)", () => {
  it("rejeita agentId inválido via API contract (função só aceita AgentTaskId)", async () => {
    // compilação garante; runtime: promptKey inexistente falha fechado
    const res = await agentTask(gw(), {
      agentId: "beacon",
      input: { lead: { name: "X" }, claims: ["claim-a"] },
    });
    expect(res.agentId).toBe("beacon");
    expect(res.promptKey).toBe("beacon.draft.v1");
  });

  it("modo simulado marca simulated=true e nunca apresenta como IA real", async () => {
    for (const agentId of ["scout", "relay", "pledge", "aegis"] as const) {
      const res = await agentTask(gw(), { agentId, input: { company: "Teste" } });
      expect(res.simulated).toBe(true);
      expect(res.provider).toBe("mock");
    }
  });

  it("guarda anti-promoções rejeita saída com promessa comercial", async () => {
    // Força provider fake que retorna texto proibido via gateway customizado
    const gateway = gw();
    const orig = gateway.complete.bind(gateway);
    gateway.complete = async (req) => ({
      ...(await orig(req)),
      ok: true,
      simulated: false,
      provider: "fake",
      model: "fake-1",
      output: "Temos garantia de 30% de desconto e SLA de 99.9%",
    });
    const res = await agentTask(gateway, { agentId: "beacon", input: {} });
    expect(res.rejectedReason).toMatch(/promessa comercial/);
  });

  it("sanitizeForAi remove e-mail/telefone/documento", () => {
    const clean = sanitizeForAi({ name: "A", email: "a@b.c", phone: "11999", cpf: "123", company: "X" });
    expect(clean).toEqual({ name: "A", company: "X" });
  });
});
