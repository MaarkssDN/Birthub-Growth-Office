import { describe, expect, it } from "vitest";
import {
  AiRouter,
  GroqProvider,
  OllamaProvider,
  OpenRouterProvider,
  XaiProvider,
  HOST_HARDWARE_INFO,
} from "@bgo/ai";

describe("AiRouter & Multi-Provider Architecture (Onda 14 — G190..G201)", () => {
  it("inicializa com 7 provedores e especificação correta do hardware hospedeiro", async () => {
    const router = new AiRouter();
    const registry = await router.getRegistry();

    expect(registry.providers.length).toBe(7);
    expect(registry.hardware.cpu).toContain("Ryzen 5 5625U");
    expect(registry.hardware.ramGb).toBe(24);
    expect(registry.hardware.gpu).toContain("Radeon");
    expect(registry.routerPolicy.maxExternalCostBrl).toBe(0);
    expect(registry.routerPolicy.preferLocal).toBe(true);
  });

  it("permite reordenar prioridade mantendo o mock no final como salvaguarda", () => {
    const router = new AiRouter();
    router.setPriority(["gemini", "groq", "ollama"]);
    const priority = router.getPriorityList();

    expect(priority[0]).toBe("gemini");
    expect(priority[1]).toBe("groq");
    expect(priority[2]).toBe("ollama");
    expect(priority[priority.length - 1]).toBe("mock");
  });

  it("OpenRouter bloqueia modelos que não possuem o sufixo :free (G195)", async () => {
    const provider = new OpenRouterProvider({
      apiKey: "test-key-mock",
      defaultModel: "openai/gpt-4o", // Modelo tarifado sem :free
    });

    const res = await provider.complete({
      agentId: "meridian",
      promptKey: "meridian.qualify.v1",
      input: { lead: { name: "Lead Teste" } },
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("bloqueado");
    expect(res.error).toContain(":free");
  });

  it("xAI/Grok bloqueia chamadas sem autorização explícita de gastos XAI_AUTHORIZED_SPEND=1 (G197)", async () => {
    const provider = new XaiProvider({
      apiKey: "test-xai-key",
      authorizedSpend: false, // Política padrão R$ 0
    });

    const status = await provider.getStatus();
    expect(status).toBe("blocked_unauthorized_expense");

    const res = await provider.complete({
      agentId: "meridian",
      promptKey: "meridian.qualify.v1",
      input: {},
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("política de custo zero");
  });

  it("GroqCloud reporta 'blocked_no_credential' quando a chave está ausente (G193)", async () => {
    const provider = new GroqProvider({ apiKey: "" });
    const status = await provider.getStatus();
    expect(status).toBe("blocked_no_credential");

    const res = await provider.complete({
      agentId: "meridian",
      promptKey: "meridian.qualify.v1",
      input: {},
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("GROQ_API_KEY ausente");
  });

  it("bloqueia chamadas para provedores externos contendo PII não sanitizada (G200)", async () => {
    const router = new AiRouter();
    // Garante que o provedor local não mascare o teste de fallback para mock
    router.registerProvider(new OllamaProvider({ baseUrl: "http://127.0.0.1:9999/v1" }));
    // Força preferência por nuvem (Groq)
    const res = await router.complete({
      agentId: "meridian",
      promptKey: "meridian.diagnose.v1",
      preferredProvider: "groq",
      input: {
        lead: {
          name: "Contato Real",
          email: "confidencial@empresa-privada.com.br", // PII não sanitizada
        },
      },
    });

    // O router intercepta e cai para o fallback seguro
    expect(res.ok).toBe(true);
    expect(res.simulated).toBe(true);

    const history = router.getHistory();
    const blockedLog = history.find((h) => h.status === "blocked");
    expect(blockedLog).toBeDefined();
    expect(blockedLog?.error).toContain("PII não sanitizada");
  });

  it("executa fallback gracioso para mock determinístico quando provedores reais falham ou não têm chave (G198)", async () => {
    const router = new AiRouter();
    // Simula indisponibilidade de Ollama para testar cadeia de fallback completa até o mock
    router.registerProvider(new OllamaProvider({ baseUrl: "http://127.0.0.1:9999/v1" }));
    const res = await router.complete({
      agentId: "meridian",
      promptKey: "meridian.diagnose.v1",
      input: {
        lead: { name: "Empresa Teste", synthetic: true },
      },
    });

    expect(res.ok).toBe(true);
    expect(res.simulated).toBe(true);
    expect(res.provider).toBe("mock");
    expect(res.model).toBe("mock-deterministic-v1");
  });

  it("testProvider executa teste controlado com payload sintético", async () => {
    const router = new AiRouter();
    const testMock = await router.testProvider("mock");
    expect(testMock.ok).toBe(true);
    expect(testMock.status).toBe("success");
    expect(testMock.output).toBeDefined();

    const testNonExistent = await router.testProvider("provider-fantasma");
    expect(testNonExistent.ok).toBe(false);
    expect(testNonExistent.status).toBe("error");
  });
});
