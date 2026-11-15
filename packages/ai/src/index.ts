/**
 * Gateway e Roteador de IA do BGO — Onda 14.
 *
 * Princípios invioláveis:
 * - Modo SIMULADO é o default e nunca é apresentado como IA real.
 * - Prioridade absoluta para inferência local (Ollama) e provedores gratuitos (Groq, Gemini, OpenRouter :free, Cloudflare).
 * - Orçamento externo estrito: R$ 0.
 * - Proteção de dados e privacidade: PII não sanitizada nunca sai da máquina local.
 * - Nenhuma saída dispara envio externo direto (channel.send continua bloqueado).
 * - Fallback resiliente com integridade de estado e auditoria append-only.
 */

import {
  AiMode,
  AiLimits,
  CompletionRequest,
  CompletionResult,
  AiUsageSinkRecord,
  ProviderAdapter,
  DEFAULT_LIMITS,
} from "./types";
import { PROMPTS, MockDeterministicProvider } from "./providers/mock";
import { OllamaProvider } from "./providers/ollama";
import { GroqProvider } from "./providers/groq";
import { GeminiProvider } from "./providers/gemini";
import { OpenRouterProvider } from "./providers/openrouter";
import { CloudflareProvider } from "./providers/cloudflare";
import { XaiProvider } from "./providers/xai";
import { AiRouter, HOST_HARDWARE_INFO } from "./router";

export * from "./types";
export * from "./router";
export * from "./meridian";
export { PROMPTS, MockDeterministicProvider } from "./providers/mock";
export { OllamaProvider } from "./providers/ollama";
export { GroqProvider } from "./providers/groq";
export { GeminiProvider } from "./providers/gemini";
export { OpenRouterProvider } from "./providers/openrouter";
export { CloudflareProvider } from "./providers/cloudflare";
export { XaiProvider } from "./providers/xai";

export class MockProvider extends MockDeterministicProvider {}

/**
 * Adaptador OpenAI-compatible legado (mantido para compatibilidade estrita com Ondas 02-13).
 */
export class OpenAICompatProvider implements ProviderAdapter {
  readonly id = "openai-compatible";
  readonly name = "openai-compatible";
  readonly type = "mock" as const;
  readonly isLocal = false;
  readonly costTier = "free" as const;
  readonly defaultModel: string;
  readonly model: string;

  constructor(
    private baseUrl: string,
    private apiKey: string,
    model: string,
  ) {
    this.model = model;
    this.defaultModel = model;
  }

  async getStatus() {
    return "ready" as const;
  }

  async getAvailableModels() {
    return [this.model];
  }

  async complete(req: CompletionRequest) {
    const prompt = PROMPTS[req.promptKey];
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_LIMITS.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: prompt?.template ?? req.promptKey },
            { role: "user", content: JSON.stringify(req.input) },
          ],
          max_tokens: Math.min(
            req.maxTokens ?? DEFAULT_LIMITS.maxTokensPerCall,
            DEFAULT_LIMITS.maxTokensPerCall,
          ),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return {
          ok: false as const,
          provider: this.name,
          providerType: "mock" as const,
          model: this.model,
          error: `HTTP ${res.status}`,
          latencyMs: Date.now() - started,
        };
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const tin = data.usage?.prompt_tokens ?? 0;
      const tout = data.usage?.completion_tokens ?? 0;
      return {
        ok: true as const,
        provider: this.name,
        providerType: "mock" as const,
        model: this.model,
        output: data.choices?.[0]?.message?.content ?? "",
        tokensIn: tin,
        tokensOut: tout,
        costUnits: Math.ceil((tin + tout) / 1000),
        latencyMs: Date.now() - started,
      };
    } catch (e) {
      return {
        ok: false as const,
        provider: this.name,
        providerType: "mock" as const,
        model: this.model,
        error: e instanceof Error ? e.message : "erro desconhecido",
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface AiStatus {
  mode: AiMode;
  provider: string;
  model: string;
  limits: AiLimits;
  promptsRegistered: number;
  realCallsEnabled: boolean;
  usage: {
    callsThisRun: number;
    costUnitsThisRun: number;
    totalCalls: number;
    totalCostUnits: number;
    totalTokens: number;
    lastDurationMs: number;
  };
}

export function aiModeFromEnv(env: NodeJS.ProcessEnv = process.env): AiMode {
  if (
    env.BGO_AI_MODE === "real" &&
    env.BGO_AI_ENABLED === "1" &&
    (env.BGO_AI_API_KEY || env.GROQ_API_KEY || env.GEMINI_API_KEY || env.OPENROUTER_API_KEY)
  ) {
    return "real";
  }
  if (env.BGO_AI_MODE === "disabled") return "disabled";
  return "simulated";
}

export class AiGateway {
  private provider: ProviderAdapter;
  private mode: AiMode;
  private limits: AiLimits;
  private calls = 0;
  private costUnits = 0;
  private totalCalls = 0;
  private totalCostUnits = 0;
  private totalTokens = 0;
  private lastDurationMs = 0;
  readonly router: AiRouter;
  usageSink?: (rec: AiUsageSinkRecord) => void;

  constructor(
    env: NodeJS.ProcessEnv = process.env,
    limits: Partial<AiLimits> = {},
  ) {
    this.mode = aiModeFromEnv(env);
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.router = new AiRouter(this.limits);

    if (this.mode === "real") {
      this.provider = new OpenAICompatProvider(
        env.BGO_AI_BASE_URL ?? "https://api.openai.com/v1",
        env.BGO_AI_API_KEY!,
        env.BGO_AI_MODEL ?? "gpt-4o-mini",
      );
    } else {
      this.provider = new MockDeterministicProvider();
    }
  }

  setUsageSink(sink: (rec: AiUsageSinkRecord) => void): void {
    this.usageSink = sink;
    this.router.usageSink = sink;
  }

  status(): AiStatus {
    return {
      mode: this.mode,
      provider: this.provider.name,
      model:
        this.provider.name === "mock" || this.provider.type === "mock"
          ? "mock-deterministic-v1"
          : (this.provider as OpenAICompatProvider).model,
      limits: this.limits,
      promptsRegistered: Object.keys(PROMPTS).length,
      realCallsEnabled: this.mode === "real",
      usage: {
        callsThisRun: this.calls,
        costUnitsThisRun: this.costUnits,
        totalCalls: this.totalCalls,
        totalCostUnits: this.totalCostUnits,
        totalTokens: this.totalTokens,
        lastDurationMs: this.lastDurationMs,
      },
    };
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const prompt = PROMPTS[req.promptKey];
    const base = {
      promptKey: req.promptKey,
      promptVersion: req.promptVersion || prompt?.version || "unversioned",
      simulated: this.mode !== "real",
    };

    if (this.mode === "disabled") {
      return {
        ...base,
        ok: false,
        provider: "none",
        model: "none",
        error: "IA desabilitada por configuração",
      };
    }

    if (this.calls >= this.limits.maxCallsPerRun) {
      return {
        ...base,
        ok: false,
        provider: this.provider.name,
        model: "n/a",
        error: `limite de ${this.limits.maxCallsPerRun} chamadas/run atingido`,
      };
    }

    this.calls += 1;
    const t0 = Date.now();

    // Se preferência de provedor foi fornecida ou se BGO_AI_MODE=real com Ollama, usa router
    let r: Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">;
    if (req.preferredProvider || req.forceReal) {
      const routerRes = await this.router.complete(req);
      r = {
        ok: routerRes.ok,
        provider: routerRes.provider,
        providerType: routerRes.providerType,
        model: routerRes.model,
        output: routerRes.output,
        tokensIn: routerRes.tokensIn,
        tokensOut: routerRes.tokensOut,
        costUnits: routerRes.costUnits,
        latencyMs: routerRes.latencyMs,
        isLocal: routerRes.isLocal,
        ...(routerRes.error ? { error: routerRes.error } : {}),
      };
      base.simulated = routerRes.simulated;
    } else {
      r = await this.provider.complete(req);
    }

    this.lastDurationMs = Date.now() - t0;
    this.totalCalls += 1;
    this.totalCostUnits += r.costUnits ?? 0;
    this.totalTokens += (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
    this.costUnits += r.costUnits ?? 0;

    if (this.costUnits > this.limits.maxCostUnitsPerRun) {
      const blocked: CompletionResult = {
        ...base,
        ok: false,
        provider: r.provider,
        model: r.model,
        error: `limite de custo ${this.limits.maxCostUnitsPerRun} units/run excedido`,
      };
      this.emitUsage(req, blocked, Date.now() - t0);
      return blocked;
    }

    const result: CompletionResult = { ...base, ...r };
    this.emitUsage(req, result, Date.now() - t0);
    return result;
  }

  private emitUsage(
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
      // sink nunca derruba inferência
    }
  }

  resetRunCounters(): void {
    this.calls = 0;
    this.costUnits = 0;
    this.router.resetRunCounters();
  }
}

export const aiGateway = new AiGateway();
export * from "./agents";
