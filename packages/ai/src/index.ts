/**
 * Gateway de IA do BGO — Onda 02.
 *
 * Princípios:
 * - Modo SIMULADO é o default e nunca é apresentado como IA real.
 * - Modo REAL exige TRÊS condições: BGO_AI_MODE=real + BGO_AI_API_KEY +
 *   BGO_AI_ENABLED=1. Sem isso, toda chamada cai no MockProvider.
 * - Nenhuma saída do gateway dispara ação externa; quem consome decide,
 *   e ações externas continuam exigindo aprovação humana (POLICY_MATRIX).
 * - Limites de chamadas/tokens/custo e timeout são enforce no gateway.
 */

export type AiMode = "simulated" | "real" | "disabled";

export interface CompletionRequest {
  agentId: string;
  promptKey: string;
  promptVersion: string;
  input: Record<string, unknown>;
  maxTokens?: number;
  /** Onda 10 — correlação p/ ledger de custos por missão. */
  missionId?: string;
  correlationId?: string;
}

/** Registro de consumo emitido pelo gateway ao ledger (Onda 10). */
export interface AiUsageSinkRecord {
  missionId?: string;
  agentId: string;
  provider: string;
  model: string;
  promptKey?: string;
  promptVersion?: string;
  simulated: boolean;
  tokensIn: number;
  tokensOut: number;
  costUnits: number;
  durationMs: number;
  status: "success" | "failure" | "blocked";
  error?: string;
  correlationId?: string;
}

export interface CompletionResult {
  ok: boolean;
  simulated: boolean;
  provider: string;
  model: string;
  promptKey: string;
  promptVersion: string;
  output?: string;
  error?: string;
  tokensIn?: number;
  tokensOut?: number;
  costUnits?: number;
  latencyMs?: number;
}

export interface ProviderAdapter {
  readonly name: string;
  complete(req: CompletionRequest): Promise<Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">>;
}

export interface AiLimits {
  maxCallsPerRun: number;
  maxTokensPerCall: number;
  maxCostUnitsPerRun: number;
  timeoutMs: number;
}

export const DEFAULT_LIMITS: AiLimits = {
  maxCallsPerRun: 8,
  maxTokensPerCall: 1200,
  maxCostUnitsPerRun: 40,
  timeoutMs: 30_000,
};

// ---------------------------------------------------------------- prompts
/** Registry versionado de prompts — mudar texto exige bump de versão. */
export const PROMPTS: Record<string, { version: string; template: string }> = {
  "meridian.qualify.v1": {
    version: "prompt-v1",
    template: "Você é Meridian, qualificador SDR do Birthub Growth Office. Avalie o lead {{lead}} contra o ICP {{icp}} usando a rubrica {{rubric}}. Responda APENAS JSON: {score, gaps[], recommendation}.",
  },
  "scout.research.v1": {
    version: "prompt-v1",
    template: "Você é Scout, pesquisador de contas. Para a conta {{company}}, liste fontes públicas verificáveis e sinais de fit. Responda JSON: {sources[], signals[]}.",
  },
  "beacon.draft.v1": {
    version: "prompt-v1",
    template: "Você é Beacon, preparador de abordagens. Escreva rascunho de primeira abordagem para {{lead}} usando SOMENTE claims aprovados: {{claims}}. Nunca prometa preço/SLA/features pendentes. Retorne texto do rascunho.",
  },
  "relay.plan.v1": {
    version: "prompt-v1",
    template: "Você é Relay, coordenador comercial. Dada a missão {{mission}}, proponha a sequência de tarefas e responsáveis. Retorne JSON: {steps[]}.",
  },
  "pledge.followup.v1": {
    version: "prompt-v1",
    template: "Você é Pledge, compromissos e follow-up. Para o lead {{lead}} e estágio {{stage}}, proponha o próximo compromisso e lembrete. Retorne JSON: {commitment, remindAt}.",
  },
  "meridian.diagnose.v1": {
    version: "prompt-v2",
    template: "Você é Meridian, qualificador SDR do Birthub Growth Office. Produza um diagnóstico comercial ESTRUTURADO do lead {{lead}} contra o ICP {{icp}} e rubrica {{rubric}}. Responda APENAS JSON válido: {diagnosis:string, justification:string, confidence:number(0-1), nextAction:string, claimRefs:string[]}. REGRAS DURAS: nunca invente preços, funcionalidades, prazos, SLA ou cases; use somente claimRefs aprovados em {{approvedClaims}}; se faltar informação, declare em justification e reduza confidence.",
  },
  "aegis.supervise.v1": {
    version: "prompt-v1",
    template: "Você é Aegis, supervisor central. Revise a missão {{mission}} quanto a riscos, aprovações pendentes e conformidade de claims. Retorne JSON: {risks[], approvalsNeeded[]}.",
  },
};

// ---------------------------------------------------------------- providers
/** Simulação determinística — NUNCA apresentada como IA real. */
export class MockProvider implements ProviderAdapter {
  readonly name = "mock";
  async complete(req: CompletionRequest) {
    const prompt = PROMPTS[`${req.promptKey}`];
    // saídas simuladas schema-válidas por prompt (diagnóstico real continua
    // exigindo provider real; aqui o conteúdo é explicitamente mock)
    let simulatedOutput: string;
    if (req.promptKey === "meridian.diagnose.v1") {
      simulatedOutput = JSON.stringify({
        diagnosis: "[SIMULADO] lead dentro do ICP hipótese; fit comercial a confirmar",
        justification: "[SIMULADO] rubrica aplicada sobre dados sintéticos; nenhuma fonte externa consultada",
        confidence: 0.4,
        nextAction: "[SIMULADO] aguardar revisão humana antes de qualquer abordagem",
        claimRefs: [],
      });
    } else {
      simulatedOutput = JSON.stringify({
        simulated: true,
        promptKey: req.promptKey,
        promptVersion: req.promptVersion ?? prompt?.version ?? "prompt-v1",
        note: "resposta simulada — nenhum modelo real foi consultado",
        inputKeys: Object.keys(req.input),
      });
    }
    return {
      ok: true,
      provider: "mock",
      model: "mock-deterministic-v1",
      output: simulatedOutput,
      tokensIn: 0,
      tokensOut: 0,
      costUnits: 0,
      latencyMs: 0,
    };
  }
}

/**
 * Adaptador OpenAI-compatible (esqueleto operacional).
 * Só é instanciado quando as 3 flags de modo real estão presentes.
 * Não há fallback silencioso: falhas retornam ok:false com erro.
 */
export class OpenAICompatProvider implements ProviderAdapter {
  readonly name = "openai-compatible";
  readonly model: string;
  constructor(
    private baseUrl: string,
    private apiKey: string,
    model: string,
  ) {
    this.model = model;
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
          max_tokens: Math.min(req.maxTokens ?? DEFAULT_LIMITS.maxTokensPerCall, DEFAULT_LIMITS.maxTokensPerCall),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        return { ok: false as const, provider: this.name, model: this.model, error: `HTTP ${res.status}` };
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
        model: this.model,
        error: e instanceof Error ? e.message : "erro desconhecido",
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------- gateway
export interface AiStatus {
  mode: AiMode;
  provider: string;
  model: string;
  limits: AiLimits;
  promptsRegistered: number;
  realCallsEnabled: boolean;
  usage: {
    callsThisRun: number; costUnitsThisRun: number;
    totalCalls: number; totalCostUnits: number; totalTokens: number; lastDurationMs: number;
  };
}

export function aiModeFromEnv(env: NodeJS.ProcessEnv = process.env): AiMode {
  if (env.BGO_AI_MODE === "real" && env.BGO_AI_ENABLED === "1" && env.BGO_AI_API_KEY) return "real";
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
  /** Sink de persistência de custos (Onda 10). Fire-and-forget; nunca quebra a inferência. */
  usageSink?: (rec: AiUsageSinkRecord) => void;

  constructor(env: NodeJS.ProcessEnv = process.env, limits: Partial<AiLimits> = {}) {
    this.mode = aiModeFromEnv(env);
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    if (this.mode === "real") {
      this.provider = new OpenAICompatProvider(
        env.BGO_AI_BASE_URL ?? "https://api.openai.com/v1",
        env.BGO_AI_API_KEY!,
        env.BGO_AI_MODEL ?? "gpt-4o-mini",
      );
    } else {
      this.provider = new MockProvider();
    }
  }

  status(): AiStatus {
    return {
      mode: this.mode,
      provider: this.provider.name,
      model: this.provider.name === "mock" ? "mock-deterministic-v1" : (this.provider as OpenAICompatProvider).model,
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
      return { ...base, ok: false, provider: "none", model: "none", error: "IA desabilitada por configuração" };
    }
    if (this.calls >= this.limits.maxCallsPerRun) {
      return { ...base, ok: false, provider: this.provider.name, model: "n/a", error: `limite de ${this.limits.maxCallsPerRun} chamadas/run atingido` };
    }
    this.calls += 1;
    const t0 = Date.now();
    const r = await this.provider.complete(req);
    this.lastDurationMs = Date.now() - t0;
    this.totalCalls += 1;
    this.totalCostUnits += r.costUnits ?? 0;
    this.totalTokens += (r.tokensIn ?? 0) + (r.tokensOut ?? 0);
    this.costUnits += r.costUnits ?? 0;
    if (this.costUnits > this.limits.maxCostUnitsPerRun) {
      const blocked: CompletionResult = { ...base, ok: false, provider: r.provider, model: r.model, error: `limite de custo ${this.limits.maxCostUnitsPerRun} units/run excedido` };
      this.emitUsage(req, blocked, Date.now() - t0);
      return blocked;
    }
    const result: CompletionResult = { ...base, ...r };
    this.emitUsage(req, result, Date.now() - t0);
    return result;
  }

  private emitUsage(req: CompletionRequest, res: CompletionResult, durationMs: number): void {
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
        ...(req.correlationId !== undefined ? { correlationId: req.correlationId } : {}),
      });
    } catch {
      // sink nunca derruba inferência
    }
  }

  resetRunCounters(): void {
    this.calls = 0;
    this.costUnits = 0;
  }
}

export const aiGateway = new AiGateway();

export * from "./meridian";
