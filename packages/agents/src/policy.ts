import type { AutonomyLevel, PolicyDecision, PolicyRequest } from "@bgo/contracts";
import { AutonomyLevel as AL } from "@bgo/contracts";
import { getAgentDefinition } from "./catalog";

export type Risk = "low" | "medium" | "high" | "critical";

export interface PolicyRule {
  agentId: string; // '*' = qualquer agente
  tool: string;
  action: string; // '*' = qualquer ação da tool
  risk: Risk;
  autonomy: AutonomyLevel;
  approvalRequired?: boolean;
  /** alwaysBlocked = L4/proibido independente de aprovação */
  alwaysBlocked?: boolean;
  reason: string;
}

/**
 * Matriz normativa Agent × Tool × Action × Risk × Approval × Permission.
 * Avaliada SOMENTE no backend — frontend nunca é autoridade.
 */
export const POLICY_MATRIX: PolicyRule[] = [
  // --- Ações internas L2 permitidas para agentes ativos ---
  { agentId: "*", tool: "mission.*", action: "*", risk: "low", autonomy: "L2", approvalRequired: false, reason: "orquestração interna auditável" },
  { agentId: "*", tool: "task.*", action: "*", risk: "low", autonomy: "L2", approvalRequired: false, reason: "tarefas internas reversíveis" },
  { agentId: "relay", tool: "task.dispatch", action: "*", risk: "low", autonomy: "L2", approvalRequired: false, reason: "Relay distribui tarefas internas" },
  { agentId: "aegis", tool: "mission.plan", action: "*", risk: "low", autonomy: "L2", approvalRequired: false, reason: "Aegis planeja/delega missões" },
  { agentId: "aegis", tool: "approval.self", action: "*", risk: "high", autonomy: "L4", alwaysBlocked: true, reason: "agente não aprova a si mesmo" },
  { agentId: "aegis", tool: "budget.modify", action: "*", risk: "high", autonomy: "L4", alwaysBlocked: true, reason: "sem alteração de orçamento" },
  { agentId: "scout", tool: "research.web", action: "*", risk: "medium", autonomy: "L1", approvalRequired: false, reason: "pesquisa em fontes autorizadas" },
  { agentId: "scout", tool: "research.scrape_restricted", action: "*", risk: "high", autonomy: "L4", alwaysBlocked: true, reason: "sem scraping restrito nem dados sensíveis" },
  { agentId: "meridian", tool: "lead.score", action: "*", risk: "low", autonomy: "L2", approvalRequired: false, reason: "score via rubrica versionada" },
  { agentId: "meridian", tool: "lead.reject_final", action: "*", risk: "high", autonomy: "L4", alwaysBlocked: true, reason: "sem recusa final sem política" },
  { agentId: "beacon", tool: "draft.create", action: "*", risk: "medium", autonomy: "L2", approvalRequired: false, reason: "rascunho interno com claims aprovados" },
  { agentId: "beacon", tool: "draft.send_external", action: "*", risk: "critical", autonomy: "L3", approvalRequired: true, reason: "envio externo exige aprovação humana + opt-in" },
  { agentId: "beacon", tool: "channel.send", action: "*", risk: "critical", autonomy: "L3", approvalRequired: true, reason: "canal externo: Onda 00 BLOQUEADO" },
  { agentId: "pledge", tool: "task.reminder", action: "*", risk: "low", autonomy: "L2", approvalRequired: false, reason: "lembretes internos" },
  { agentId: "pledge", tool: "calendar.confirm", action: "*", risk: "high", autonomy: "L3", approvalRequired: true, reason: "confirmação externa exige evidência" },
  { agentId: "pledge", tool: "followup.send_external", action: "*", risk: "critical", autonomy: "L3", approvalRequired: true, reason: "follow-up externo bloqueado na W00" },

  // --- L3: ação externa sensível — somente com aprovação explícita ---
  { agentId: "*", tool: "channel.send", action: "*", risk: "critical", autonomy: "L3", approvalRequired: true, reason: "envio externo: consentimento + aprovação + integração autorizada" },
  { agentId: "*", tool: "calendar.invite", action: "*", risk: "high", autonomy: "L3", approvalRequired: true, reason: "convite externo exige aprovação" },
  { agentId: "*", tool: "proposal.send", action: "*", risk: "high", autonomy: "L3", approvalRequired: true, reason: "proposta externa exige aprovação humana" },

  // --- L4: proibido na Onda 00 (e estruturalmente) ---
  { agentId: "*", tool: "payment.*", action: "*", risk: "critical", autonomy: "L4", alwaysBlocked: true, reason: "pagamento proibido" },
  { agentId: "*", tool: "contract.*", action: "*", risk: "critical", autonomy: "L4", alwaysBlocked: true, reason: "contrato proibido" },
  { agentId: "*", tool: "campaign.mass_send", action: "*", risk: "critical", autonomy: "L4", alwaysBlocked: true, reason: "disparo em massa proibido" },
  { agentId: "*", tool: "infra.*", action: "*", risk: "critical", autonomy: "L4", alwaysBlocked: true, reason: "alteração de infraestrutura proibida" },
  { agentId: "*", tool: "tenant.*", action: "*", risk: "critical", autonomy: "L4", alwaysBlocked: true, reason: "acesso inter-tenant proibido" },
  { agentId: "*", tool: "policy.*", action: "modify", risk: "critical", autonomy: "L4", alwaysBlocked: true, reason: "bypass de política proibido" },
];

function matchRule(rule: PolicyRule, req: PolicyRequest): boolean {
  const agentOk = rule.agentId === "*" || rule.agentId === req.agentId;
  const toolOk = rule.tool === req.tool || rule.tool.endsWith(".*") && req.tool.startsWith(rule.tool.slice(0, -1));
  const actionOk = rule.action === "*" || rule.action === req.action;
  return agentOk && toolOk && actionOk;
}

/**
 * Avalia uma ação solicitada por um agente.
 * Ordem: bloqueios L4 primeiro; depois aprovação; depois checagem de contexto
 * (opt-in, canal, claim aprovado, self-approval, cross-tenant).
 */
export function evaluatePolicy(rawReq: PolicyRequest): PolicyDecision {
  const c = rawReq.context;
  const req: PolicyRequest = {
    ...rawReq,
    context: {
      hasApproval: c?.hasApproval ?? false,
      channelAllowed: c?.channelAllowed ?? false,
      optInVerified: c?.optInVerified ?? false,
      claimApproved: c?.claimApproved ?? true,
      selfApproval: c?.selfApproval ?? false,
      crossTenant: c?.crossTenant ?? false,
    },
  };
  const def = getAgentDefinition(req.agentId);
  if (!def) {
    return { allowed: false, level: "L4", requiresApproval: false, reason: `agente desconhecido: ${req.agentId}` };
  }
  if (!def.active) {
    return { allowed: false, level: "L4", requiresApproval: false, reason: `agente ${req.agentId} não está ativo na Onda 00` };
  }

  const candidates = POLICY_MATRIX.filter((r) => matchRule(r, req));
  const blocked = candidates.find((r) => r.alwaysBlocked);
  if (blocked) {
    return { allowed: false, level: blocked.autonomy, requiresApproval: false, reason: blocked.reason };
  }

  // Contexto obrigatório para qualquer ação que toque canal externo
  const touchesExternal =
    req.tool.startsWith("channel.") ||
    req.tool.includes("send") ||
    req.tool.includes("invite") ||
    req.tool.startsWith("proposal.");

  if (touchesExternal) {
    if (req.context.crossTenant) {
      return { allowed: false, level: "L4", requiresApproval: false, reason: "acesso inter-tenant proibido" };
    }
    if (req.context.selfApproval) {
      return { allowed: false, level: "L4", requiresApproval: false, reason: "auto-aprovação proibida" };
    }
    if (!req.context.channelAllowed) {
      return { allowed: false, level: "L3", requiresApproval: true, reason: "canal externo não autorizado (ChannelPermission.allowed=false na W00)" };
    }
    if (!req.context.optInVerified) {
      return { allowed: false, level: "L3", requiresApproval: true, reason: "opt-in não verificado" };
    }
    if (!req.context.claimApproved) {
      return { allowed: false, level: "L3", requiresApproval: true, reason: "claim comercial não aprovado" };
    }
    if (!req.context.hasApproval) {
      return { allowed: false, level: "L3", requiresApproval: true, reason: "aprovação humana explícita obrigatória (L3)" };
    }
    // Mesmo com tudo aprovado, W00 bloqueia envios reais (integração inexistente).
    return { allowed: false, level: "L3", requiresApproval: true, reason: "envio externo indisponível na Onda 00 (modo simulação)" };
  }

  const rule = candidates.sort((a, b) => levelRank(b.autonomy) - levelRank(a.autonomy))[0];
  if (!rule) {
    return { allowed: false, level: "L4", requiresApproval: false, reason: `sem regra para ${req.agentId}/${req.tool}/${req.action}` };
  }
  if (levelRank(rule.autonomy) > levelRank(def.autonomyCeiling) && rule.autonomy !== "L4") {
    return { allowed: false, level: rule.autonomy, requiresApproval: rule.approvalRequired ?? false, reason: `ação excede teto de autonomia ${def.autonomyCeiling} do agente` };
  }
  return { allowed: true, level: rule.autonomy, requiresApproval: rule.approvalRequired ?? false, reason: rule.reason };
}

function levelRank(l: AutonomyLevel): number {
  return AL.options.indexOf(l);
}

/** Versão da política para auditoria. */
export const POLICY_VERSION = "policy-v1";
