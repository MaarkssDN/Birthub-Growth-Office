import { describe, expect, it } from "vitest";
import { activeAgents, layerCounts, listAgents, loadCatalog, getPersona } from "@bgo/agents";

describe("catálogo canônico 29", () => {
  it("tem exatamente 29 personagens com IDs únicos", () => {
    const c = loadCatalog();
    expect(c.personas).toHaveLength(29);
    expect(c.meta.total).toBe(29);
    const ids = c.personas.map((p) => p.id);
    expect(new Set(ids).size).toBe(29);
  });

  it("respeita a composição 9 pilares + 15 comerciais + 4 canais + 1 supervisão", () => {
    const counts = layerCounts();
    expect(counts).toEqual({ pillar: 9, commercial: 15, channel: 4, supervision: 1 });
  });

  it("preserva os IDs canônicos dos pilares", () => {
    const pillars = loadCatalog().personas.filter((p) => p.layer === "pillar").map((p) => p.id);
    expect(pillars.sort()).toEqual(
      ["aria", "core", "echo", "nexus", "orbit", "oracle", "spark", "sudo", "vanguard"].sort(),
    );
  });

  it("marca exatamente 6 agentes ativos da Onda 00", () => {
    const active = activeAgents().map((a) => a.agentId).sort();
    expect(active).toEqual(["aegis", "beacon", "meridian", "pledge", "relay", "scout"]);
    expect(activeAgents()).toHaveLength(6);
  });

  it("agentes não ativos estão PLANEJADO e pilares não são executores", () => {
    const agents = listAgents();
    const pillars = agents.filter((a) => a.layer === "pillar");
    for (const p of pillars) {
      expect(p.active).toBe(false);
      expect(p.implementationStatus).toBe("PLANEJADO");
    }
    for (const a of agents.filter((x) => !x.active)) {
      expect(a.implementationStatus).toBe("PLANEJADO");
    }
  });

  it("personas têm paleta de 3 cores e nomes do catálogo", () => {
    for (const p of loadCatalog().personas) {
      expect(p.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.name.length).toBeGreaterThan(0);
      expect(getPersona(p.id)?.id).toBe(p.id);
    }
  });
});
