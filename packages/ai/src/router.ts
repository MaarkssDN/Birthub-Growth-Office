import { randomUUID } from "node:crypto";
import type {
  ProviderAdapter,
  AiProviderInfo,
  AiProviderRegistry,
  AiHardwareInfo,
  AiInferenceLog,
  CompletionRequest,
  CompletionResult,
  AiLimits,
  AiUsageSinkRecord,
} from "./types";
import { DEFAULT_LIMITS } from "./types";
import { MockDeterministicProvider } from "./providers/mock";
import { OllamaProvider } from "./providers/ollama";
import { GroqProvider } from "./providers/groq";
import { GeminiProvider } from "./providers/gemini";
import { OpenRouterProvider } from "./providers/openrouter";
import { CloudflareProvider } from "./providers/cloudflare";
import { XaiProvider } from "./providers/xai";

export const HOST_HARDWARE_INFO: AiHardwareInfo = {
  cpu: "AMD Ryzen 5 5625U with Radeon Graphics",
  cores: 6,
  ramGb: 24,
  gpu: "AMD Radeon(TM) Graphics",
  vramMb: 512,
  os: "Windows 11",
};

export class AiRouter {
  private providers: Map<string, ProviderAdapter> = new Map();
  private priorityList: string[] = [
    "ollama",
    "groq",
    "gemini",
    "openrouter",
    "cloudflare",
    "xai",
    "mock",
  ];
  private logs: AiInferenceLog[] = [];
  private limits: AiLimits;
  private callsThisRun = 0;
  private costUnitsThisRun = 0;
  usageSink?: (rec: AiUsageSinkRecord) => void;

  constructor(limits: Partial<AiLimits> = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };

    // Registra todos os provedores suportados
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new GroqProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new OpenRouterProvider());
    this.registerProvider(new CloudflareProvider());
    this.registerProvider(new XaiProvider());
    this.registerProvider(new MockDeterministicProvider());
  }

  registerProvider(adapter: ProviderAdapter): void {
    this.providers.set(adapter.id, adapter);
  }

  getProvider(id: string): ProviderAdapter | undefined {
    return this.providers.get(id);
  }

  getPriorityList(): string[] {
    return [...this.priorityList];
  }

  setPriority(newPriority: string[]): void {
    // Garante que 'mock' permaneça no final como rede de segurança
    const valid = newPriority.filter((id) => this.providers.has(id));
    if (!valid.includes("mock")) valid.push("mock");
    this.priorityList = valid;
  }

  async getRegistry(): Promise<AiProviderRegistry> {
    const providerInfos: AiProviderInfo[] = [];

    for (const [idx, id] of this.priorityList.entries()) {
      const adapter = this.providers.get(id);
      if (!adapter) continue;
      const status = await adapter.getStatus();
      const availableModels = await adapter.getAvailableModels();

      providerInfos.push({
        id: adapter.id,
        name: adapter.name,
        type: adapter.type,
        status,
        isLocal: adapter.isLocal,
        costTier: adapter.costTier,
        model: adapter.defaultModel,
        availableModels,
        priority: idx + 1,
        privacyTier: adapter.isLocal
          ? "local_confidential"
          : adapter.costTier === "paid"
            ? "blocked"
            : "synthetic_only",
        hardwareInfo: adapter.isLocal ? HOST_HARDWARE_INFO : undefined,
      });
    }

    // Determina o provedor primário ativo atualmente disponível
    let activeId = "mock";
    for (const p of providerInfos) {
      if (p.id !== "mock" && (p.status === "ready" || p.status === "credentialed")) {
        activeId = p.id;
        break;
      }
    }

    return {
      activeProviderId: activeId,
      providers: providerInfos,
      hardware: HOST_HARDWARE_INFO,
      routerPolicy: {
        maxExternalCostBrl: 0,
        preferLocal: true,
        enforcePrivacySanitization: true,
        allowPaidTier: false,
      },
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Executa teste controlado com payload sintético em um provedor específico.
   */
  async testProvider(
    providerId: string,
  ): Promise<{
    ok: boolean;
    provider: string;
    model: string;
    status: string;
    latencyMs: number;
    output?: string | undefined;
    error?: string | undefined;
  }> {
    const adapter = this.providers.get(providerId);
    if (!adapter) {
      return {
        ok: false,
        provider: providerId,
        model: "n/a",
        status: "error",
        latencyMs: 0,
        error: `Provedor '${providerId}' não encontrado`,
      };
    }

    const testReq: CompletionRequest = {
      agentId: "meridian",
      promptKey: "meridian.qualify.v1",
      promptVersion: "prompt-v1",
      input: {
        lead: {
          name: "Empresa Piloto Sintética LTDA",
          segment: "Logística",
          synthetic: true,
        },
        icp: { targetSegment: "Logística" },
        rubric: "criterio_basico_v1",
      },
      maxTokens: 300,
    };

    const res = await adapter.complete(testReq);
    return {
      ok: res.ok,
      provider: adapter.name,
      model: res.model,
      status: res.ok ? "success" : "failure",
      latencyMs: res.latencyMs ?? 0,
      output: res.output,
      error: res.error,
    };
  }

  /**
   * Executa a inferência com roteamento inteligente, proteção de privacidade e fallback resiliente.
   */
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const promptVersion = req.promptVersion ?? "v1";

    // Salvaguarda de limite de chamadas
    if (this.callsThisRun >= this.limits.maxCallsPerRun) {
      return {
        ok: false,
        simulated: true,
        provider: "router",
        model: "none",
        promptKey: req.promptKey,
        promptVersion,
        error: `Limite de chamadas por execução atingido (${this.limits.maxCallsPerRun})`,
      };
    }

    this.callsThisRun += 1;

    // Constrói lista de candidatos a tentar
    let candidateIds: string[] = [];
    if (req.preferredProvider && this.providers.has(req.preferredProvider)) {
      candidateIds.push(req.preferredProvider);
      // adiciona os demais como fallback
      for (const id of this.priorityList) {
        if (id !== req.preferredProvider) candidateIds.push(id);
      }
    } else {
      candidateIds = [...this.priorityList];
    }

    let lastError = "Nenhum provedor disponível";
    let attemptsCount = 0;

    for (const id of candidateIds) {
      const adapter = this.providers.get(id);
      if (!adapter) continue;

      const status = await adapter.getStatus();

      // Pula provedores sem chave ou serviço desligado (exceto se for preferred explícito)
      if (
        id !== "mock" &&
        status !== "ready" &&
        status !== "credentialed" &&
        id !== req.preferredProvider
      ) {
        continue;
      }

      // Salvaguarda de Privacidade (Gate G200):
      // Se não for provedor local e o payload contiver dados confidenciais ou não sintéticos, bloqueia envio externo
      if (!adapter.isLocal) {
        const inputStr = JSON.stringify(req.input);
        const hasPiiPattern =
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/.test(inputStr) ||
          /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(inputStr);

        if (hasPiiPattern) {
          // Rejeita envio externo de PII
          this.logInference({
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            agentId: req.agentId,
            promptKey: req.promptKey,
            promptVersion,
            provider: adapter.name,
            providerType: adapter.type,
            model: adapter.defaultModel,
            simulated: false,
            isLocal: false,
            status: "blocked",
            latencyMs: 0,
            tokensIn: 0,
            tokensOut: 0,
            costUnits: 0,
            costBrl: 0,
            error: "Bloqueio de privacidade: PII não sanitizada em chamada externa",
            missionId: req.missionId,
            correlationId: req.correlationId,
          });
          continue;
        }
      }

      attemptsCount++;
      const result = await adapter.complete(req);

      if (result.ok) {
        const isSimulated = adapter.type === "mock";
        const costUnits = result.costUnits ?? 0;
        this.costUnitsThisRun += costUnits;

        const finalResult: CompletionResult = {
          ok: true,
          simulated: isSimulated,
          provider: result.provider,
          providerType: result.providerType,
          model: result.model,
          promptKey: req.promptKey,
          promptVersion,
          output: result.output,
          tokensIn: result.tokensIn ?? 0,
          tokensOut: result.tokensOut ?? 0,
          costUnits,
          latencyMs: result.latencyMs ?? 0,
          isLocal: result.isLocal ?? adapter.isLocal,
        };

        this.logInference({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          agentId: req.agentId,
          promptKey: req.promptKey,
          promptVersion,
          provider: result.provider,
          providerType: adapter.type,
          model: result.model,
          simulated: isSimulated,
          isLocal: Boolean(result.isLocal),
          status: attemptsCount > 1 ? "fallback" : "success",
          latencyMs: result.latencyMs ?? 0,
          tokensIn: result.tokensIn ?? 0,
          tokensOut: result.tokensOut ?? 0,
          costUnits,
          costBrl: 0, // Política de custo R$ 0
          missionId: req.missionId,
          correlationId: req.correlationId,
        });

        this.emitSink(req, finalResult, result.latencyMs ?? 0);
        return finalResult;
      } else {
        lastError = result.error ?? "Erro desconhecido";
        this.logInference({
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          agentId: req.agentId,
          promptKey: req.promptKey,
          promptVersion,
          provider: adapter.name,
          providerType: adapter.type,
          model: adapter.defaultModel,
          simulated: adapter.type === "mock",
          isLocal: adapter.isLocal,
          status: "failure",
          latencyMs: result.latencyMs ?? 0,
          tokensIn: 0,
          tokensOut: 0,
          costUnits: 0,
          costBrl: 0,
          error: result.error,
          missionId: req.missionId,
          correlationId: req.correlationId,
        });
      }
    }

    // Se chegou até aqui sem sucesso e o mock não foi chamado, chama o mock como salvaguarda
    const mock = this.providers.get("mock") as MockDeterministicProvider;
    const fallbackRes = await mock.complete(req);
    const finalResult: CompletionResult = {
      ok: true,
      simulated: true,
      provider: mock.name,
      providerType: "mock",
      model: mock.defaultModel,
      promptKey: req.promptKey,
      promptVersion,
      output: fallbackRes.output,
      tokensIn: 0,
      tokensOut: 0,
      costUnits: 0,
      latencyMs: fallbackRes.latencyMs ?? 5,
      isLocal: true,
      error: `Fallback determinístico acionado. Último erro: ${lastError}`,
    };

    this.logInference({
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      agentId: req.agentId,
      promptKey: req.promptKey,
      promptVersion,
      provider: mock.name,
      providerType: "mock",
      model: mock.defaultModel,
      simulated: true,
      isLocal: true,
      status: "fallback",
      latencyMs: fallbackRes.latencyMs ?? 5,
      tokensIn: 0,
      tokensOut: 0,
      costUnits: 0,
      costBrl: 0,
      error: `Recuperado por fallback: ${lastError}`,
      missionId: req.missionId,
      correlationId: req.correlationId,
    });

    this.emitSink(req, finalResult, fallbackRes.latencyMs ?? 5);
    return finalResult;
  }

  private logInference(log: AiInferenceLog): void {
    this.logs.unshift(log);
    if (this.logs.length > 100) {
      this.logs.pop();
    }
  }

  getHistory(): AiInferenceLog[] {
    return [...this.logs];
  }

  private emitSink(
    req: CompletionRequest,
    res: CompletionResult,
    durationMs: number,
  ): void {
    if (!this.usageSink) return;
    try {
      this.usageSink({
        ...(req.missionId !== undefined ? { missionId: req.missionId } : {}),
        agentId: req.agentId,
        provider: res.provider,
        model: res.model,
        promptKey: req.promptKey,
        promptVersion: res.promptVersion,
        simulated: res.simulated,
        tokensIn: res.tokensIn ?? 0,
        tokensOut: res.tokensOut ?? 0,
        costUnits: res.costUnits ?? 0,
        durationMs,
        status: res.ok ? "success" : "failure",
        ...(res.error !== undefined ? { error: res.error } : {}),
        ...(req.correlationId !== undefined
          ? { correlationId: req.correlationId }
          : {}),
      });
    } catch {
      // Sink não derruba fluxo principal
    }
  }

  resetRunCounters(): void {
    this.callsThisRun = 0;
    this.costUnitsThisRun = 0;
  }
}
