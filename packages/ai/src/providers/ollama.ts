import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResult,
  AiProviderStatus,
} from "../types";
import { PROMPTS } from "./mock";

export interface OllamaModelTag {
  name: string;
  size: number;
  modified_at: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export class OllamaProvider implements ProviderAdapter {
  readonly id = "ollama";
  readonly name = "Ollama Local";
  readonly type = "ollama" as const;
  readonly isLocal = true;
  readonly costTier = "free" as const;
  defaultModel: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(options?: {
    baseUrl?: string;
    defaultModel?: string;
    timeoutMs?: number;
  }) {
    this.baseUrl = (
      options?.baseUrl ??
      process.env.BGO_OLLAMA_BASE_URL ??
      "http://127.0.0.1:11434"
    ).replace(/\/$/, "");
    this.defaultModel =
      options?.defaultModel ??
      process.env.BGO_OLLAMA_MODEL ??
      "qwen2.5:3b";
    this.timeoutMs = options?.timeoutMs ?? 60_000;
  }

  async getStatus(): Promise<AiProviderStatus> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return "service_down";
      const data = (await res.json()) as { models?: OllamaModelTag[] };
      const models = data.models ?? [];
      if (models.length === 0) return "service_ready_no_models";
      return "ready";
    } catch {
      return "service_down";
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3_000);
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: OllamaModelTag[] };
      return (data.models ?? []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  async complete(
    req: CompletionRequest,
  ): Promise<
    Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">
  > {
    const prompt = PROMPTS[req.promptKey];
    const available = await this.getAvailableModels();
    const model =
      req.preferredModel ??
      (available.includes(this.defaultModel)
        ? this.defaultModel
        : (available[0] ?? this.defaultModel));
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const systemPrompt = prompt?.template ?? req.promptKey;
    const userPrompt = JSON.stringify(req.input);

    const isJsonPrompt =
      req.promptKey.includes("diagnose") ||
      req.promptKey.includes("qualify") ||
      req.promptKey.includes("plan") ||
      req.promptKey.includes("supervise") ||
      req.promptKey.includes("followup") ||
      req.promptKey.includes("research");

    try {
      // Usando endpoint compatível OpenAI /v1/chat/completions do Ollama
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: req.maxTokens ?? 1000,
          temperature: 0.2,
          ...(isJsonPrompt ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return {
          ok: false,
          provider: this.name,
          providerType: this.type,
          model,
          error: `Ollama HTTP ${res.status}: ${errorText || res.statusText}`,
          latencyMs: Date.now() - started,
          isLocal: true,
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
        costUnits: 0, // Custo financeiro zero para chamadas locais
        latencyMs: Date.now() - started,
        isLocal: true,
      };
    } catch (e) {
      return {
        ok: false,
        provider: this.name,
        providerType: this.type,
        model,
        error:
          e instanceof Error
            ? `Falha de conexão com Ollama: ${e.message}`
            : "Erro desconhecido ao chamar Ollama",
        latencyMs: Date.now() - started,
        isLocal: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
