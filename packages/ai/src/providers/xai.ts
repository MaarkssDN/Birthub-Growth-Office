import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResult,
  AiProviderStatus,
} from "../types";
import { PROMPTS } from "./mock";

export class XaiProvider implements ProviderAdapter {
  readonly id = "xai";
  readonly name = "xAI Grok (Controlado / Pago)";
  readonly type = "xai" as const;
  readonly isLocal = false;
  readonly costTier = "paid" as const;
  defaultModel: string;
  private apiKey?: string | undefined;
  private authorizedSpend: boolean;
  private timeoutMs: number;

  constructor(options?: {
    apiKey?: string | undefined;
    authorizedSpend?: boolean | undefined;
    defaultModel?: string | undefined;
    timeoutMs?: number | undefined;
  }) {
    this.apiKey =
      options?.apiKey ??
      process.env.XAI_API_KEY ??
      process.env.BGO_XAI_API_KEY;
    this.authorizedSpend =
      options?.authorizedSpend ??
      (process.env.XAI_AUTHORIZED_SPEND === "1" ||
        process.env.BGO_XAI_AUTHORIZED_SPEND === "1");
    this.defaultModel =
      options?.defaultModel ?? process.env.XAI_MODEL ?? "grok-beta";
    this.timeoutMs = options?.timeoutMs ?? 30_000;
  }

  async getStatus(): Promise<AiProviderStatus> {
    if (!this.authorizedSpend) {
      return "blocked_unauthorized_expense";
    }
    if (!this.apiKey) {
      return "blocked_no_credential";
    }
    return "credentialed";
  }

  async getAvailableModels(): Promise<string[]> {
    return ["grok-beta", "grok-2-vision-1212"];
  }

  async complete(
    req: CompletionRequest,
  ): Promise<
    Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">
  > {
    if (!this.authorizedSpend) {
      return {
        ok: false,
        provider: this.name,
        providerType: this.type,
        model: this.defaultModel,
        error:
          "xAI Grok bloqueado: política de custo zero (R$ 0) proíbe chamadas tarifadas sem autorização explícita (XAI_AUTHORIZED_SPEND=1)",
        latencyMs: 0,
        isLocal: false,
      };
    }

    if (!this.apiKey) {
      return {
        ok: false,
        provider: this.name,
        providerType: this.type,
        model: this.defaultModel,
        error: "xAI Grok não configurado: chave XAI_API_KEY ausente",
        latencyMs: 0,
        isLocal: false,
      };
    }

    const prompt = PROMPTS[req.promptKey];
    const model = req.preferredModel ?? this.defaultModel;
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch("https://api.xai.com/v1/chat/completions", {
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
          error: `xAI HTTP ${res.status}: ${res.statusText}`,
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
        costUnits: Math.ceil((tokensIn + tokensOut) / 1000),
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
            ? `Erro de conexão xAI: ${e.message}`
            : "Erro desconhecido ao chamar xAI",
        latencyMs: Date.now() - started,
        isLocal: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
