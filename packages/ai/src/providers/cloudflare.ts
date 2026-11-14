import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResult,
  AiProviderStatus,
} from "../types";
import { PROMPTS } from "./mock";

export class CloudflareProvider implements ProviderAdapter {
  readonly id = "cloudflare";
  readonly name = "Cloudflare Workers AI (Free Tier)";
  readonly type = "cloudflare" as const;
  readonly isLocal = false;
  readonly costTier = "free" as const;
  defaultModel: string;
  private apiKey?: string | undefined;
  private accountId?: string | undefined;
  private timeoutMs: number;

  constructor(options?: {
    apiKey?: string | undefined;
    accountId?: string | undefined;
    defaultModel?: string | undefined;
    timeoutMs?: number | undefined;
  }) {
    this.apiKey =
      options?.apiKey ??
      process.env.CLOUDFLARE_API_KEY ??
      process.env.BGO_CLOUDFLARE_API_KEY;
    this.accountId =
      options?.accountId ??
      process.env.CLOUDFLARE_ACCOUNT_ID ??
      process.env.BGO_CLOUDFLARE_ACCOUNT_ID;
    this.defaultModel =
      options?.defaultModel ??
      process.env.CLOUDFLARE_MODEL ??
      "@cf/meta/llama-3.1-8b-instruct";
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  async getStatus(): Promise<AiProviderStatus> {
    if (!this.apiKey || !this.accountId) return "blocked_no_credential";
    return "credentialed";
  }

  async getAvailableModels(): Promise<string[]> {
    return [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/mistral/mistral-7b-instruct-v0.1",
    ];
  }

  async complete(
    req: CompletionRequest,
  ): Promise<
    Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">
  > {
    if (!this.apiKey || !this.accountId) {
      return {
        ok: false,
        provider: this.name,
        providerType: this.type,
        model: this.defaultModel,
        error:
          "Cloudflare Workers AI não configurado: CLOUDFLARE_API_KEY e/ou CLOUDFLARE_ACCOUNT_ID ausentes",
        latencyMs: 0,
        isLocal: false,
      };
    }

    const prompt = PROMPTS[req.promptKey];
    const model = req.preferredModel ?? this.defaultModel;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1`;

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
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
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        return {
          ok: false,
          provider: this.name,
          providerType: this.type,
          model,
          error: `Cloudflare Workers AI HTTP ${res.status}: ${res.statusText}`,
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
        costUnits: 0, // Cota diária gratuita (10k neurônios/dia)
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
            ? `Erro de conexão Cloudflare Workers AI: ${e.message}`
            : "Erro desconhecido ao chamar Cloudflare Workers AI",
        latencyMs: Date.now() - started,
        isLocal: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
