import { describe, expect, it } from "vitest";
import { Store } from "@bgo/commercial";
import { canTransition, InvalidTransition, LEAD_TRANSITIONS } from "@bgo/commercial";
import type { LeadStatus } from "@bgo/contracts";

function storeWithLead(status: LeadStatus = "new") {
  const store = new Store();
  const lead = store.createLead(
    { name: "T", source: "synthetic", synthetic: true },
    "test",
  );
  // força status para testes de máquina
  (store.leads.get(lead.id) as { status: LeadStatus }).status = status;
  return { store, lead };
}

describe("máquina de estados do lead", () => {
  it("cobre todos os 9 status", () => {
    expect(Object.keys(LEAD_TRANSITIONS)).toHaveLength(9);
  });

  it("new → triage → qualified é válido", () => {
    expect(canTransition("new", "triage")).toBe(true);
    expect(canTransition("triage", "qualified")).toBe(true);
  });

  it("new → qualified direto é inválido", () => {
    expect(canTransition("new", "qualified")).toBe(false);
  });

  it("won e suppressed são terminais", () => {
    expect(LEAD_TRANSITIONS.won).toEqual([]);
    expect(LEAD_TRANSITIONS.suppressed).toEqual([]);
    expect(canTransition("won", "nurture")).toBe(false);
    expect(canTransition("suppressed", "triage")).toBe(false);
  });

  it("transitionLead aplica e rejeita inválidas", () => {
    const { store, lead } = storeWithLead("new");
    const t = store.transitionLead(lead.id, "triage", "test");
    expect(t.status).toBe("triage");
    expect(() => store.transitionLead(lead.id, "won", "test")).toThrow(InvalidTransition);
  });
});
