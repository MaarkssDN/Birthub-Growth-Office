import type {
  ProviderAdapter,
  CompletionRequest,
  CompletionResult,
  AiProviderStatus,
} from "../types";

export const PROMPTS: Record<string, { version: string; template: string }> = {
  "meridian.qualify.v1": {
    version: "prompt-v1",
    template:
      "Você é Meridian, qualificador SDR do Birthub Growth Office. Avalie o lead {{lead}} contra o ICP {{icp}} usando a rubrica {{rubric}}. Responda APENAS JSON: {score, gaps[], recommendation}.",
  },
  "scout.research.v1": {
    version: "prompt-v1",
    template:
      "Você é Scout, pesquisador de contas. Para a conta {{company}}, liste fontes públicas verificáveis e sinais de fit. Responda JSON: {sources[], signals[]}.",
  },
  "beacon.draft.v1": {
    version: "prompt-v1",
    template:
      "Você é Beacon, preparador de abordagens. Escreva rascunho de primeira abordagem para {{lead}} usando SOMENTE claims aprovados: {{claims}}. Nunca prometa preço/SLA/features pendentes. Retorne texto do rascunho.",
  },
  "relay.plan.v1": {
    version: "prompt-v1",
    template:
      "Você é Relay, coordenador comercial. Dada a missão {{mission}}, proponha a sequência de tarefas e responsáveis. Retorne JSON: {steps[]}.",
  },
  "pledge.followup.v1": {
    version: "prompt-v1",
    template:
      "Você é Pledge, compromissos e follow-up. Para o lead {{lead}} e estágio {{stage}}, proponha o próximo compromisso e lembrete. Retorne JSON: {commitment, remindAt}.",
  },
  "meridian.diagnose.v1": {
    version: "prompt-v2",
    template:
      "Você é Meridian, qualificador SDR do Birthub Growth Office. Produza um diagnóstico comercial ESTRUTURADO do lead {{lead}} contra o ICP {{icp}} e rubrica {{rubric}}. Responda APENAS JSON válido: {diagnosis:string, justification:string, confidence:number(0-1), nextAction:string, claimRefs:string[]}. REGRAS DURAS: nunca invente preços, funcionalidades, prazos, SLA ou cases; use somente claimRefs aprovados em {{approvedClaims}}; se faltar informação, declare em justification e reduza confidence.",
  },
  "aegis.supervise.v1": {
    version: "prompt-v1",
    template:
      "Você é Aegis, supervisor central. Revise a missão {{mission}} quanto a riscos, aprovações pendentes e conformidade de claims. Retorne JSON: {risks[], approvalsNeeded[]}.",
  },
};

export class MockDeterministicProvider implements ProviderAdapter {
  readonly id = "mock";
  readonly name = "mock";
  readonly displayName = "Simulação Determinística";
  readonly type = "mock" as const;
  readonly isLocal = true;
  readonly costTier = "free" as const;
  readonly defaultModel = "mock-deterministic-v1";

  async getStatus(): Promise<AiProviderStatus> {
    return "ready";
  }

  async getAvailableModels(): Promise<string[]> {
    return ["mock-deterministic-v1"];
  }

  async complete(
    req: CompletionRequest,
  ): Promise<
    Omit<CompletionResult, "promptKey" | "promptVersion" | "simulated">
  > {
    const prompt = PROMPTS[req.promptKey];
    let output: string;

    if (req.promptKey === "meridian.diagnose.v1") {
      output = JSON.stringify({
        diagnosis:
          "[SIMULADO] lead dentro do ICP hipótese; fit comercial a confirmar",
        justification:
          "[SIMULADO] rubrica aplicada sobre dados sintéticos; nenhuma fonte externa consultada",
        confidence: 0.4,
        nextAction:
          "[SIMULADO] aguardar revisão humana antes de qualquer abordagem",
        claimRefs: [],
      });
    } else if (req.promptKey === "meridian.qualify.v1") {
      output = JSON.stringify({
        score: 75,
        gaps: ["[SIMULADO] validar CNAE oficial", "[SIMULADO] confirmar decisor comercial"],
        recommendation: "[SIMULADO] avançar para qualificação aprofundada",
      });
    } else if (req.promptKey === "scout.research.v1") {
      output = JSON.stringify({
        sources: ["Receita Federal / CNPJ Público", "Portal da Transparência", "Site institucional"],
        signals: ["[SIMULADO] crescimento de quadro funcional", "[SIMULADO] presença digital ativa"],
      });
    } else if (req.promptKey === "beacon.draft.v1") {
      output =
        "[SIMULADO] Olá, identificamos alinhamento com a infraestrutura do Birthub Growth Office. Gostaríamos de apresentar como estruturamos a operação com governança completa.";
    } else if (req.promptKey === "relay.plan.v1") {
      output = JSON.stringify({
        steps: [
          "[SIMULADO] 1. Validar elegibilidade cadastral",
          "[SIMULADO] 2. Homologar claims de proposta",
          "[SIMULADO] 3. Submeter para aprovação do operador",
        ],
      });
    } else if (req.promptKey === "pledge.followup.v1") {
      output = JSON.stringify({
        commitment: "[SIMULADO] Contato de acompanhamento agendado",
        remindAt: new Date(Date.now() + 86400000 * 2).toISOString(),
      });
    } else if (req.promptKey === "aegis.supervise.v1") {
      output = JSON.stringify({
        risks: ["[SIMULADO] monitoramento de canal externo bloqueado"],
        approvalsNeeded: ["aprovação humana para transição de estágio"],
      });
    } else {
      output = JSON.stringify({
        simulated: true,
        promptKey: req.promptKey,
        promptVersion: req.promptVersion ?? prompt?.version ?? "prompt-v1",
        note: "resposta simulada — nenhum modelo real foi consultado",
        inputKeys: Object.keys(req.input),
      });
    }

    return {
      ok: true,
      provider: this.name,
      providerType: this.type,
      model: this.defaultModel,
      output,
      tokensIn: 0,
      tokensOut: 0,
      costUnits: 0,
      latencyMs: 5,
      isLocal: true,
    };
  }
}
