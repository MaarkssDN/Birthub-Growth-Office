/**
 * Birthub Growth Office — Sandbox de Comunicação Supervisionada (Onda 12 / Fase 05).
 *
 * Princípios Invioláveis:
 * 1. NUNCA produz envios externos reais (`channel.send` bloqueado pelo policy engine).
 * 2. Mensagens são geradas e avaliadas em ambiente estritamente simulado e isolado.
 * 3. Aprovação de rascunho NÃO equivale a disparo automático.
 * 4. Persiste registros de disparos simulados para auditoria completa e idempotência.
 * 5. Testa cenários de sucesso, erro explícito, concorrência, supressão e tentativas não autorizadas.
 */

import { randomUUID } from "node:crypto";
import type {
  Channel,
  CommercialDraft,
  CommunicationDispatch,
  CommunicationDispatchStatus,
} from "@bgo/contracts";

export type SandboxSimulationScenario =
  | "success"
  | "network_timeout"
  | "bounce"
  | "rate_limit"
  | "suppressed"
  | "unauthorized";

export interface SandboxDispatchInput {
  workspaceId: string;
  draftId?: string | undefined;
  opportunityId?: string | undefined;
  channel: Channel;
  recipient: string;
  subject?: string | undefined;
  content: string;
  dispatchedBy: string;
  correlationId?: string | undefined;
  scenario?: SandboxSimulationScenario | undefined;
  isDraftApproved?: boolean | undefined;
}

export interface SandboxDispatchResult {
  dispatch: CommunicationDispatch;
  duplicated: boolean;
  simulatedPayload: {
    channel: Channel;
    recipientMasked: string;
    subject?: string | undefined;
    bodyLength: number;
    headers: Record<string, string>;
  };
}

export interface CommunicationSandboxStorePort {
  saveDispatch(dispatch: CommunicationDispatch): Promise<void>;
  getDispatchByCorrelation(workspaceId: string, correlationId: string): Promise<CommunicationDispatch | null>;
  listDispatches(workspaceId: string, filters?: { channel?: Channel; status?: CommunicationDispatchStatus }): Promise<CommunicationDispatch[]>;
  isRecipientSuppressed(workspaceId: string, recipient: string): Promise<boolean>;
}

/** In-Memory Store para testes e fallback */
export class MemoryCommunicationSandboxStore implements CommunicationSandboxStorePort {
  private dispatches: CommunicationDispatch[] = [];
  private suppressedRecipients: Set<string> = new Set(["optout@empresa.com.br", "bloqueado@teste.com"]);

  async saveDispatch(dispatch: CommunicationDispatch): Promise<void> {
    const idx = this.dispatches.findIndex((d) => d.id === dispatch.id);
    if (idx >= 0) this.dispatches[idx] = dispatch;
    else this.dispatches.unshift(dispatch);
  }

  async getDispatchByCorrelation(workspaceId: string, correlationId: string): Promise<CommunicationDispatch | null> {
    return this.dispatches.find((d) => d.workspaceId === workspaceId && d.correlationId === correlationId) ?? null;
  }

  async listDispatches(workspaceId: string, filters?: { channel?: Channel; status?: CommunicationDispatchStatus }): Promise<CommunicationDispatch[]> {
    return this.dispatches.filter((d) => {
      if (d.workspaceId !== workspaceId) return false;
      if (filters?.channel && d.channel !== filters.channel) return false;
      if (filters?.status && d.status !== filters.status) return false;
      return true;
    });
  }

  async isRecipientSuppressed(workspaceId: string, recipient: string): Promise<boolean> {
    const norm = recipient.trim().toLowerCase();
    return this.suppressedRecipients.has(norm);
  }

  addSuppressedRecipient(recipient: string): void {
    this.suppressedRecipients.add(recipient.trim().toLowerCase());
  }
}

/**
 * Executa o despacho simulado no Sandbox de Comunicação.
 */
export async function dispatchSandboxMessage(
  store: CommunicationSandboxStorePort,
  input: SandboxDispatchInput,
): Promise<SandboxDispatchResult> {
  const correlationId = input.correlationId ?? randomUUID();

  // 1. Verificação de Idempotência
  const existing = await store.getDispatchByCorrelation(input.workspaceId, correlationId);
  if (existing) {
    return {
      dispatch: existing,
      duplicated: true,
      simulatedPayload: buildSimulatedPayload(existing),
    };
  }

  let status: CommunicationDispatchStatus = "sent_simulated";
  let errorReason: string | undefined = undefined;

  // 2. Validação de Rascunho Aprovado / Não Autorizado
  const isApproved = input.isDraftApproved ?? true;
  if (!isApproved || input.scenario === "unauthorized") {
    status = "blocked_unauthorized";
    errorReason = "Envio bloqueado: rascunho de comunicação não possui aprovação formal de supervisor.";
  }
  // 3. Verificação de Supressão / Opt-out
  else if (input.scenario === "suppressed" || (await store.isRecipientSuppressed(input.workspaceId, input.recipient))) {
    status = "blocked_suppressed";
    errorReason = "Envio bloqueado: destinatário registrado na lista de supressão / opt-out do workspace.";
  }
  // 4. Cenários de Falha Simulada
  else if (input.scenario === "network_timeout") {
    status = "error_simulated";
    errorReason = "Simulação de timeout: conexão expirou sem resposta do gateway SMTP/sandbox.";
  } else if (input.scenario === "bounce") {
    status = "error_simulated";
    errorReason = "Simulação de bounce: caixa postal inexistente ou domínio rejeitou entrega de teste.";
  } else if (input.scenario === "rate_limit") {
    status = "error_simulated";
    errorReason = "Simulação de rate-limit: cota de disparos de homologação excedida na janela atual.";
  }

  const dispatch: CommunicationDispatch = {
    id: `disp_${randomUUID()}`,
    workspaceId: input.workspaceId,
    draftId: input.draftId,
    opportunityId: input.opportunityId,
    channel: input.channel,
    recipient: input.recipient,
    subject: input.subject,
    content: input.content,
    status,
    simulated: true, // Inviolável: sempre true
    errorReason,
    dispatchedBy: input.dispatchedBy,
    correlationId,
    createdAt: new Date().toISOString(),
  };

  await store.saveDispatch(dispatch);

  return {
    dispatch,
    duplicated: false,
    simulatedPayload: buildSimulatedPayload(dispatch),
  };
}

function buildSimulatedPayload(dispatch: CommunicationDispatch) {
  const parts = dispatch.recipient.split("@");
  const masked = parts.length === 2 && parts[0]
    ? `${parts[0].slice(0, 2)}***@${parts[1]}`
    : `${dispatch.recipient.slice(0, 3)}***`;

  return {
    channel: dispatch.channel,
    recipientMasked: masked,
    ...(dispatch.subject !== undefined ? { subject: dispatch.subject } : {}),
    bodyLength: dispatch.content.length,
    headers: {
      "X-BGO-Sandbox": "true",
      "X-BGO-Correlation-ID": dispatch.correlationId,
      "X-BGO-Simulated-Status": dispatch.status,
    },
  };
}
