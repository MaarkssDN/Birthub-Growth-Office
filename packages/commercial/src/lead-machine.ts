import type { LeadStatus } from "@bgo/contracts";

/**
 * Máquina de estados explícita e auditável do lead.
 * `suppressed` é terminal para contato (opt-out), mas o registro é preservado.
 */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["triage", "suppressed"],
  triage: ["qualified", "nurture", "suppressed"],
  qualified: ["meeting_requested", "nurture", "lost", "suppressed"],
  nurture: ["triage", "qualified", "lost", "suppressed"],
  meeting_requested: ["proposal", "nurture", "lost", "suppressed"],
  proposal: ["won", "lost", "suppressed"],
  won: [],
  lost: ["nurture"],
  suppressed: [],
};

export class InvalidTransition extends Error {
  constructor(from: LeadStatus, to: LeadStatus) {
    super(`transição de lead inválida: ${from} → ${to}`);
    this.name = "InvalidTransition";
  }
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: LeadStatus, to: LeadStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransition(from, to);
}
