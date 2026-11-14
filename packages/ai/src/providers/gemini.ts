import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResult,
  AiProviderStatus,
} from "../types";
import { PROMPTS } from "./mock";

export class GeminiProvider implements ProviderAdapter {
  readonly id = "gemini";
  readonly name = "Google Gemini (Free Tier)";
  readonly type = "gemini" as const;
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
      process.env.GEMINI_API_KEY ??
      process.env.BGO_GEMINI_API_KEY;
    this.baseUrl = (
      options?.baseUrl ??
      process.env.GEMINI_BASE_URL ??
      "https://generativelanguage.googleapis.com/v1beta/openai"
    ).replace(/\/$/, "");
    this.defaultModel =
      options?.defaultModel ??
      process.env.GEMINI_MODEL ??
      "gemini-1.5-flash";
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  async getStatus(): Promise<AiProviderStatus> {
    if (!this.apiKey) return "blocked_no_credential";
    return "credentialed";
  }

  async getAvailableModels(): Promise<string[]> {
    return ["gemini-1.5-flash", "gemini-2.0-flash"];
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
          "Google Gemini não configurado: chave GEMINI_API_KEY ausente no ambiente",
        latencyMs: 0,
        isLocal: false,
      };
    }

    const prompt = PROMPTS[req.promptKey];
    const model = req.preferredModel ?? this.defaultModel;
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
            error: "Gemini free tier quota excedida (HTTP 429) — fallback acionado",
            latencyMs: Date.now() - started,
            isLocal: false,
          };
        }
        return {
          ok: false,
          provider: this.name,
          providerType: this.type,
          model,
          error: `Google Gemini HTTP ${res.status}: ${res.statusText}`,
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
        costUnits: 0,
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
            ? `Erro de conexão Google Gemini: ${e.message}`
            : "Erro desconhecido ao chamar Google Gemini",
        latencyMs: Date.now() - started,
        isLocal: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
