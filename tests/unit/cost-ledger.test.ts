import { describe, expect, it } from "vitest";
import {
  CostLedger,
  MemoryCostStore,
  estimateCostUsd,
  type AiTariff,
  type AiUsageInput,
} from "@bgo/commercial";

const usage = (over: Partial<AiUsageInput> = {}): AiUsageInput => ({
  agentId: "meridian",
  provider: "openai-compatible",
  model: "gemini-2.0-flash",
  simulated: false,
  tokensIn: 1000,
  tokensOut: 500,
  costUnits: 2,
  durationMs: 120,
  status: "success",
  ...over,
});

const TARIFF: Omit<AiTariff, "id" | "createdAt"> = {
  version: "tariff-v1",
  provider: "openai-compatible",
  model: "gemini-2.0-flash",
  currency: "USD",
  inputPer1MTokens: 0.1,
  outputPer1MTokens: 0.4,
  active: true,
};

describe("CostLedger — histórico e tarifas (G95/G117)", () => {
  it("registra uso por missão/agente e estima custo somente com tarifa ativa", async () => {
    const store = new MemoryCostStore();
    const ledger = new CostLedger(store);
    await ledger.addTariff(TARIFF);

    const rec = await ledger.record(usage({ missionId: "m1", correlationId: "c1" }));
    expect(rec.estimatedCost).toBeCloseTo(0.0003, 6); // 1000*0.1/1M + 500*0.4/1M
    expect(rec.tariffVersion).toBe("tariff-v1");
    expect(rec.billedCost).toBeNull(); // nunca inventa faturamento

    // sem tarifa para outro modelo → estimatedCost null
    const rec2 = await ledger.record(usage({ model: "outro-modelo" }));
    expect(rec2.estimatedCost).toBeNull();
    expect(rec2.tariffVersion).toBeNull();

    const page = await ledger.usage({ missionId: "m1" });
    expect(page.total).toBe(1);
    expect(page.items[0]!.agentId).toBe("meridian");
  });

  it("simulated=true não gera estimativa e não consome orçamento real", async () => {
    const store = new MemoryCostStore();
    const ledger = new CostLedger(store, { dailyUnits: 5 });
    await ledger.addTariff(TARIFF);
    await ledger.record(usage({ simulated: true, costUnits: 100 }));
    const s = await ledger.budgetStatus();
    expect(s.daily.used).toBe(0); // mock não é despesa real
    expect(s.blocked).toBe(false);
  });
});

describe("CostLedger — orçamento diário/mensal (G96/G118)", () => {
  it("insertUsageGuarded bloqueia chamada que excederia o limite diário", async () => {
    const store = new MemoryCostStore();
    const ledger = new CostLedger(store, { dailyUnits: 4, monthlyUnits: 100 });
    const r1 = await ledger.record(usage({ costUnits: 3 }));
    expect(r1.status).toBe("success");
    // 3 + 2 > 4 → a segunda chamada é bloqueada e auditada com costUnits 0
    const r2 = await ledger.record(usage({ costUnits: 2 }));
    expect(r2.status).toBe("blocked");
    expect(r2.costUnits).toBe(0);
    expect(r2.error).toMatch(/diário/);
    const s = await ledger.budgetStatus();
    expect(s.daily.used).toBe(3); // somente consumo comprometido conta
    expect(s.blocked).toBe(false); // ainda há margem p/ chamadas menores
    // consumo que atinge o limite → assertBudget bloqueia novas inferências
    await store.insertUsage({ ...usage({ costUnits: 1 }), id: "x", estimatedCost: null, billedCost: null, tariffVersion: null, occurredAt: new Date().toISOString() });
    const check = await ledger.assertBudget();
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/diário/);
  });

  it("limite mensal bloqueia chamada que excederia a cota", async () => {
    const store = new MemoryCostStore();
    const ledger = new CostLedger(store, { monthlyUnits: 10 });
    await ledger.record(usage({ costUnits: 10 }));
    const r = await ledger.record(usage({ costUnits: 1 }));
    expect(r.status).toBe("blocked");
    expect(r.error).toMatch(/mensal/);
  });

  it("concorrência: apenas uma das chamadas simultâneas que excederiam o limite passa", async () => {
    const store = new MemoryCostStore();
    const ledger = new CostLedger(store, { dailyUnits: 6 });
    const [a, b] = await Promise.all([ledger.record(usage({ costUnits: 4 })), ledger.record(usage({ costUnits: 4 }))]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["blocked", "success"]);
    const s = await ledger.budgetStatus();
    expect(s.daily.used).toBe(4); // nunca ultrapassa o limite
  });
});

describe("estimateCostUsd", () => {
  it("calcula por 1M tokens de entrada/saída", () => {
    const t = { ...TARIFF, id: "t", createdAt: "" } as AiTariff;
    expect(estimateCostUsd(1_000_000, 0, t)).toBeCloseTo(0.1, 6);
    expect(estimateCostUsd(0, 1_000_000, t)).toBeCloseTo(0.4, 6);
    expect(estimateCostUsd(0, 0, t)).toBe(0);
  });
});
