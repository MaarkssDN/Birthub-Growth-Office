import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "@bgo/agents";
import type { PolicyRequest } from "@bgo/contracts";

/**
 * G54 — RBAC granular por agente: cada especialista só executa suas
 * ferramentas; ferramentas de outros agentes e ações L4 são negadas.
 */
const ctx = (): PolicyRequest["context"] => ({
  hasApproval: false, channelAllowed: false, optInVerified: false,
  claimApproved: true, selfApproval: false, crossTenant: false,
});
const req = (agentId: string, tool: string, action = "*") =>
  ({ agentId, tool, action, context: ctx() }) as PolicyRequest;

const AGENTS = ["aegis", "relay", "scout", "meridian", "beacon", "pledge"] as const;

describe("RBAC granular por agente (G54)", () => {
  it("cada agente ativo tem permissão na própria ferramenta principal", () => {
    const own: Record<string, [string, string]> = {
      aegis: ["mission.plan", "plan"],
      relay: ["task.dispatch", "dispatch"],
      scout: ["research.web", "search"],
      meridian: ["lead.score", "score"],
      beacon: ["draft.create", "create"],
      pledge: ["task.reminder", "remind"],
    };
    for (const a of AGENTS) {
      const [tool, action] = own[a];
      const d = evaluatePolicy(req(a, tool, action));
      expect(d.allowed, `${a}/${tool} deveria ser permitido`).toBe(true);
    }
  });

  it("ferramentas exclusivas de outros agentes (sem regra '*') são negadas", () => {
    // research.web só tem regra para scout — beacon não pode pesquisar
    expect(evaluatePolicy(req("beacon", "research.web", "search")).allowed).toBe(false);
    expect(evaluatePolicy(req("aegis", "research.web", "search")).allowed).toBe(false);
    // draft.create só beacon
    expect(evaluatePolicy(req("scout", "draft.create", "create")).allowed).toBe(false);
    expect(evaluatePolicy(req("meridian", "draft.create", "create")).allowed).toBe(false);
    // lead.score só meridian (não há wildcard lead.*)
    expect(evaluatePolicy(req("relay", "lead.score", "score")).allowed).toBe(false);
    // calendar.confirm só pledge
    expect(evaluatePolicy(req("beacon", "calendar.confirm", "confirm")).allowed).toBe(false);
    // mission.*/task.* são genéricas por design — NÃO entram neste teste
  });

  it("tarefas internas genéricas (mission.*/task.*) são permitidas a todos os ativos", () => {
    for (const a of AGENTS) {
      expect(evaluatePolicy(req(a, "mission.read", "read")).allowed).toBe(true);
      expect(evaluatePolicy(req(a, "task.update", "update")).allowed).toBe(true);
    }
  });

  it("L4 sempre bloqueado independente do agente", () => {
    for (const a of AGENTS) {
      for (const tool of ["payment.charge", "contract.sign", "campaign.mass_send", "infra.modify", "tenant.access", "policy.modify"]) {
        expect(evaluatePolicy(req(a, tool, "*")).allowed, `${a}/${tool}`).toBe(false);
      }
    }
  });

  it("envios externos exigem L3 + contexto completo e ainda assim negados na W00", () => {
    const full = {
      hasApproval: true, channelAllowed: true, optInVerified: true,
      claimApproved: true, selfApproval: false, crossTenant: false,
    };
    for (const a of AGENTS) {
      const d = evaluatePolicy({ agentId: a, tool: "channel.send", action: "send", context: full } as PolicyRequest);
      expect(d.allowed).toBe(false);
      expect(d.requiresApproval).toBe(true);
    }
  });

  it("agente inativo/desconhecido é negado", () => {
    expect(evaluatePolicy(req("unknown-agent", "task.read", "read")).allowed).toBe(false);
  });
});
