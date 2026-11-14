import { describe, expect, it } from "vitest";
import {
  dispatchSandboxMessage,
  MemoryCommunicationSandboxStore,
} from "@bgo/commercial";

describe("Sandbox de Comunicação Comercial (G155-G158)", () => {
  it("despacha mensagem simulada com sucesso sem executar chamada externa", async () => {
    const store = new MemoryCommunicationSandboxStore();
    const result = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "email",
      recipient: "comercial@empresa-sintetica.com.br",
      subject: "Apresentação de Parceria BGO",
      content: "Proposta preliminar baseada em claims aprovados.",
      scenario: "success",
      correlationId: "corr-sandbox-1",
      dispatchedBy: "operator:test",
    });

    expect(result.dispatch.id).toBeDefined();
    expect(result.dispatch.status).toBe("sent_simulated");
    expect(result.dispatch.simulated).toBe(true);
    expect(result.duplicated).toBe(false);
    expect(result.simulatedPayload.recipientMasked).toContain("co***@empresa-sintetica.com.br");
    expect(result.simulatedPayload.headers["X-BGO-Sandbox"]).toBe("true");
    expect(result.simulatedPayload.headers["X-BGO-Correlation-ID"]).toBe("corr-sandbox-1");

    // Verifica persistência na store
    const persisted = await store.getDispatchByCorrelation("ws_default", "corr-sandbox-1");
    expect(persisted).toBeDefined();
    expect(persisted?.status).toBe("sent_simulated");
  });

  it("simula cenários de erro controlados (timeout, bounce, rate_limit, unauthorized)", async () => {
    const store = new MemoryCommunicationSandboxStore();

    // Timeout
    const resTimeout = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "whatsapp",
      recipient: "+5511999990001",
      content: "Mensagem teste",
      scenario: "network_timeout",
      dispatchedBy: "operator:test",
    });
    expect(resTimeout.dispatch.status).toBe("error_simulated");
    expect(resTimeout.dispatch.errorReason).toContain("timeout");

    // Bounce
    const resBounce = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "email",
      recipient: "invalido@inexistente-dominio.com",
      content: "Mensagem teste",
      scenario: "bounce",
      dispatchedBy: "operator:test",
    });
    expect(resBounce.dispatch.status).toBe("error_simulated");
    expect(resBounce.dispatch.errorReason).toContain("bounce");

    // Rate limit
    const resRate = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "email",
      recipient: "teste@empresa.com",
      content: "Mensagem teste",
      scenario: "rate_limit",
      dispatchedBy: "operator:test",
    });
    expect(resRate.dispatch.status).toBe("error_simulated");
    expect(resRate.dispatch.errorReason).toContain("rate-limit");

    // Unauthorized
    const resUnauth = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "linkedin",
      recipient: "linkedin.com/in/perfil-teste",
      content: "Mensagem teste",
      scenario: "unauthorized",
      dispatchedBy: "operator:test",
    });
    expect(resUnauth.dispatch.status).toBe("blocked_unauthorized");
    expect(resUnauth.dispatch.errorReason).toContain("aprovação formal");
  });

  it("bloqueia destinatários em lista de opt-out (suppressed)", async () => {
    const store = new MemoryCommunicationSandboxStore();
    store.addSuppressedRecipient("optout@cliente.com.br");

    const res = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "email",
      recipient: "optout@cliente.com.br",
      content: "Tentativa de envio",
      scenario: "success",
      dispatchedBy: "operator:test",
    });

    expect(res.dispatch.status).toBe("blocked_suppressed");
    expect(res.dispatch.errorReason).toContain("supressão / opt-out");
  });

  it("garante idempotência estrita via correlationId", async () => {
    const store = new MemoryCommunicationSandboxStore();
    const corr = "unique-corr-12345";

    const first = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "email",
      recipient: "contato@empresa.com.br",
      content: "Primeiro disparo",
      correlationId: corr,
      dispatchedBy: "operator:test",
    });
    expect(first.duplicated).toBe(false);

    const second = await dispatchSandboxMessage(store, {
      workspaceId: "ws_default",
      channel: "email",
      recipient: "contato@empresa.com.br",
      content: "Tentativa repetida",
      correlationId: corr,
      dispatchedBy: "operator:test",
    });
    expect(second.duplicated).toBe(true);
    expect(second.dispatch.id).toBe(first.dispatch.id);
  });
});
