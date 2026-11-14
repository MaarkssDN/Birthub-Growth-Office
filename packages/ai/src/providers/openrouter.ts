import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResult,
  AiProviderStatus,
} from "../types";
import { PROMPTS } from "./mock";

export class OpenRouterProvider implements ProviderAdapter {
  readonly id = "openrouter";
  readonly name = "OpenRouter (:free models)";
  readonly type = "openrouter" as const;
  readonly isLocal = false;
  readonly costTier = "free" as const;
  defaultModel: string;
  private baseUrl: string;
  private apiKey?: string | undefined;
  private timeoutMs: number;

  constructor(options?: {
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
    timeoutMs?: number | undefined;
  }) {
    this.apiKey =
      options?.apiKey ??
      process.env.OPENROUTER_API_KEY ??
      process.env.BGO_OPENROUTER_API_KEY;
    this.baseUrl = (
      options?.baseUrl ??
      process.env.OPENROUTER_BASE_URL ??
      "https://openrouter.ai/api/v1"
    ).replace(/\/$/, "");
    this.defaultModel =
      options?.defaultModel ??
      process.env.OPENROUTER_MODEL ??
      "meta-llama/llama-3.2-3b-instruct:free";
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  async getStatus(): Promise<AiProviderStatus> {
    if (!this.apiKey) return "blocked_no_credential";
    return "credentialed";
  }

  async getAvailableModels(): Promise<string[]> {
    return [
      "meta-llama/llama-3.2-3b-instruct:free",
      "qwen/qwen-2.5-7b-instruct:free",
      "google/gemma-2-9b-it:free",
    ];
  }

  async complete(
    req: CompletionRequest,
  ): Promise<
    Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">
  > {
    if (!this.apiKey) {
      return {
        ok: false,
        provider: this.name,
        providerType: this.type,
        model: this.defaultModel,
        error:
          "OpenRouter não configurado: chave OPENROUTER_API_KEY ausente no ambiente",
        latencyMs: 0,
        isLocal: false,
      };
    }

    const model = req.preferredModel ?? this.defaultModel;

    // Salvaguarda inviolável: modelos pagos são rejeitados imediatamente no OpenRouter
    if (!model.endsWith(":free")) {
      return {
        ok: false,
        provider: this.name,
        providerType: this.type,
        model,
        error: `Modelo '${model}' bloqueado: política de custo zero exige sufixo ':free' no OpenRouter`,
        latencyMs: 0,
        isLocal: false,
      };
    }

    const prompt = PROMPTS[req.promptKey];
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const isJsonPrompt =
      req.promptKey.includes("diagnose") ||
      req.promptKey.includes("qualify") ||
      req.promptKey.includes("plan") ||
      req.promptKey.includes("supervise") ||
      req.promptKey.includes("followup") ||
      req.promptKey.includes("research");

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          "http-referer": "https://birthub-growth-office.local",
          "x-title": "Birthub Growth Office",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: prompt?.template ?? req.promptKey },
            { role: "user", content: JSON.stringify(req.input) },
          ],
          max_tokens: req.maxTokens ?? 1000,
          temperature: 0.2,
          ...(isJsonPrompt ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          return {
            ok: false,
            provider: this.name,
            providerType: this.type,
            model,
            error: "OpenRouter rate limit (:free) atingido (HTTP 429) — acionando fallback",
            latencyMs: Date.now() - started,
            isLocal: false,
          };
        }
        return {
          ok: false,
          provider: this.name,
          providerType: this.type,
          model,
          error: `OpenRouter HTTP ${res.status}: ${res.statusText}`,
          latencyMs: Date.now() - started,
          isLocal: false,
        };
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const output = data.choices?.[0]?.message?.content ?? "";
      const tokensIn = data.usage?.prompt_tokens ?? 0;
      const tokensOut = data.usage?.completion_tokens ?? 0;

      return {
        ok: true,
        provider: this.name,
        providerType: this.type,
        model,
        output,
        tokensIn,
        tokensOut,
        costUnits: 0, // Modelos :free garantem custo financeiro zero
        latencyMs: Date.now() - started,
        isLocal: false,
      };
    } catch (e) {
      return {
        ok: false,
        provider: this.name,
        providerType: this.type,
        model,
        error:
          e instanceof Error
            ? `Erro de conexão OpenRouter: ${e.message}`
            : "Erro desconhecido ao chamar OpenRouter",
        latencyMs: Date.now() - started,
        isLocal: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
