import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResult,
  AiProviderStatus,
} from "../types";
import { PROMPTS } from "./mock";

export class GroqProvider implements ProviderAdapter {
  readonly id = "groq";
  readonly name = "GroqCloud (Free Tier)";
  readonly type = "groq" as const;
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
      process.env.GROQ_API_KEY ??
      process.env.BGO_GROQ_API_KEY;
    this.baseUrl = (
      options?.baseUrl ??
      process.env.GROQ_BASE_URL ??
      "https://api.groq.com/openai/v1"
    ).replace(/\/$/, "");
    this.defaultModel =
      options?.defaultModel ??
      process.env.GROQ_MODEL ??
      "llama-3.1-8b-instant";
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  async getStatus(): Promise<AiProviderStatus> {
    if (!this.apiKey) return "blocked_no_credential";
    return "credentialed";
  }

  async getAvailableModels(): Promise<string[]> {
    return [
      "llama-3.1-8b-instant",
      "llama-3.3-70b-versatile",
      "mixtral-8x7b-32768",
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
          "GroqCloud não configurado: chave GROQ_API_KEY ausente no ambiente",
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
            error: "GroqCloud rate limit excedido (HTTP 429) — acionando fallback",
            latencyMs: Date.now() - started,
            isLocal: false,
          };
        }
        return {
          ok: false,
          provider: this.name,
          providerType: this.type,
          model,
          error: `GroqCloud HTTP ${res.status}: ${res.statusText}`,
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
        costUnits: 0, // Plano gratuito
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
            ? `Erro de conexão GroqCloud: ${e.message}`
            : "Erro desconhecido ao chamar GroqCloud",
        latencyMs: Date.now() - started,
        isLocal: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
