/**
 * Tipos e contratos do Gateway e Roteador de IA Multiprovedor — Onda 14.
 */

export type AiProviderType =
  | "ollama"
  | "groq"
  | "gemini"
  | "openrouter"
  | "cloudflare"
  | "xai"
  | "mock";

export type AiCostTier = "free" | "freemium" | "paid";

export type AiProviderStatus =
  | "ready"
  | "service_ready_no_models"
  | "service_down"
  | "credentialed"
  | "blocked_no_credential"
  | "blocked_unauthorized_expense"
  | "disabled"
  | "rate_limited"
  | "error";

export type AiPrivacyTier = "local_confidential" | "synthetic_only" | "blocked";

export interface AiHardwareInfo {
  cpu: string;
  cores?: number | undefined;
  ramGb: number;
  gpu: string;
  vramMb?: number | undefined;
  os?: string | undefined;
}

export interface AiProviderInfo {
  id: string;
  name: string;
  type: AiProviderType;
  status: AiProviderStatus;
  isLocal: boolean;
  costTier: AiCostTier;
  model: string;
  availableModels: string[];
  priority: number;
  latencyMs?: number | undefined;
  error?: string | undefined;
  rateLimit?:
    | {
        rpm?: number | undefined;
        rpd?: number | undefined;
        resetAt?: string | undefined;
      }
    | undefined;
  privacyTier: AiPrivacyTier;
  hardwareInfo?: AiHardwareInfo | undefined;
}

export interface AiProviderRegistry {
  activeProviderId: string;
  providers: AiProviderInfo[];
  hardware: AiHardwareInfo;
  routerPolicy: {
    maxExternalCostBrl: 0;
    preferLocal: true;
    enforcePrivacySanitization: true;
    allowPaidTier: false;
  };
  updatedAt: string;
}

export interface AiInferenceLog {
  id: string;
  timestamp: string;
  agentId: string;
  promptKey: string;
  promptVersion: string;
  provider: string;
  providerType: AiProviderType;
  model: string;
  simulated: boolean;
  isLocal: boolean;
  status: "success" | "failure" | "blocked" | "fallback";
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costUnits: number;
  costBrl: number;
  error?: string | undefined;
  missionId?: string | undefined;
  correlationId?: string | undefined;
}

export type AiMode = "simulated" | "real" | "disabled";

export interface CompletionRequest {
  agentId: string;
  promptKey: string;
  promptVersion?: string | undefined;
  input: Record<string, unknown>;
  maxTokens?: number | undefined;
  missionId?: string | undefined;
  correlationId?: string | undefined;
  preferredProvider?: (AiProviderType | string) | undefined;
  preferredModel?: string | undefined;
  forceReal?: boolean | undefined;
}

export interface CompletionResult {
  ok: boolean;
  simulated: boolean;
  provider: string;
  providerType?: AiProviderType | undefined;
  model: string;
  promptKey: string;
  promptVersion: string;
  output?: string | undefined;
  error?: string | undefined;
  tokensIn?: number | undefined;
  tokensOut?: number | undefined;
  costUnits?: number | undefined;
  latencyMs?: number | undefined;
  isLocal?: boolean | undefined;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly type: AiProviderType;
  readonly isLocal: boolean;
  readonly costTier: AiCostTier;
  readonly defaultModel: string;
  getStatus(): Promise<AiProviderStatus>;
  getAvailableModels(): Promise<string[]>;
  complete(
    req: CompletionRequest,
  ): Promise<
    Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">
  >;
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

export interface AiUsageSinkRecord {
  missionId?: string | undefined;
  agentId: string;
  provider: string;
  model: string;
  promptKey?: string | undefined;
  promptVersion?: string | undefined;
  simulated: boolean;
  tokensIn: number;
  tokensOut: number;
  costUnits: number;
  durationMs: number;
  status: "success" | "failure" | "blocked";
  error?: string | undefined;
  correlationId?: string | undefined;
}
