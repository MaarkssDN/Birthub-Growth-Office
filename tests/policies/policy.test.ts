import { describe, expect, it } from "vitest";
import { evaluatePolicy, POLICY_MATRIX, POLICY_VERSION } from "@bgo/agents";
import type { PolicyRequest } from "@bgo/contracts";

const ctx = (over: Partial<PolicyRequest["context"]> = {}): PolicyRequest["context"] => ({
  hasApproval: false,
  channelAllowed: false,
  optInVerified: false,
  claimApproved: true,
  selfApproval: false,
  crossTenant: false,
  ...over,
});

const req = (agentId: string, tool: string, action: string, context = ctx()): PolicyRequest => ({
  agentId, tool, action, context,
});

describe("policy engine — negações (G04)", () => {
  it("POLICY_VERSION registrada", () => {
    expect(POLICY_VERSION).toBe("policy-v1");
    expect(POLICY_MATRIX.length).toBeGreaterThan(10);
  });

  it("channel.send é negado mesmo COM aprovação, opt-in e canal permitido (W00)", () => {
    const d = evaluatePolicy(req("beacon", "channel.send", "send_email", ctx({
      hasApproval: true, channelAllowed: true, optInVerified: true, claimApproved: true,
    })));
    expect(d.allowed).toBe(false);
    expect(d.level).toBe("L3");
  });

  it("channel.send negado sem aprovação", () => {
    const d = evaluatePolicy(req("beacon", "channel.send", "send_whatsapp"));
    expect(d.allowed).toBe(false);
  });

  it("pagamento/contrato/disparo em massa são L4 sempre bloqueados", () => {
    for (const [tool, action] of [
      ["payment.charge", "charge"],
      ["contract.sign", "sign"],
      ["campaign.mass_send", "send"],
    ] as const) {
      const d = evaluatePolicy(req("aegis", tool, action, ctx({ hasApproval: true, channelAllowed: true, optInVerified: true })));
      expect(d.allowed).toBe(false);
      expect(d.level).toBe("L4");
    }
  });

  it("bypass de política e cross-tenant são L4", () => {
    expect(evaluatePolicy(req("aegis", "policy.modify", "modify")).allowed).toBe(false);
    expect(evaluatePolicy(req("aegis", "tenant.access", "read", ctx({ crossTenant: true }))).allowed).toBe(false);
  });

  it("agente não pode aprovar a si mesmo", () => {
    const d = evaluatePolicy(req("aegis", "approval.self", "approve_own"));
    expect(d.allowed).toBe(false);
  });

  it("agente inativo/não catalogado não executa", () => {
    expect(evaluatePolicy(req("orbit", "mission.plan", "create")).allowed).toBe(false);
    expect(evaluatePolicy(req("agente_inexistente", "task.dispatch", "assign")).allowed).toBe(false);
  });

  it("ações internas L2 dos ativos são permitidas", () => {
    expect(evaluatePolicy(req("aegis", "mission.plan", "create_mission")).allowed).toBe(true);
    expect(evaluatePolicy(req("relay", "task.dispatch", "assign_task")).allowed).toBe(true);
    expect(evaluatePolicy(req("scout", "research.web", "search_account")).allowed).toBe(true);
    expect(evaluatePolicy(req("meridian", "lead.score", "apply_rubric")).allowed).toBe(true);
    expect(evaluatePolicy(req("beacon", "draft.create", "compose")).allowed).toBe(true);
    expect(evaluatePolicy(req("pledge", "task.reminder", "create_reminder")).allowed).toBe(true);
  });

  it("scout não pode scraping restrito", () => {
    const d = evaluatePolicy(req("scout", "research.scrape_restricted", "scrape"));
    expect(d.allowed).toBe(false);
    expect(d.level).toBe("L4");
  });

  it("ação sem regra correspondente é negada por padrão", () => {
    const d = evaluatePolicy(req("meridian", "bank.transfer", "send"));
    expect(d.allowed).toBe(false);
  });
});
