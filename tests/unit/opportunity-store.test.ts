import { describe, expect, it } from "vitest";
import {
  assertOpportunityTransition,
  checkPriorityRule,
  InvalidOpportunityTransition,
  maxPriorityForScore,
  MemoryCompanyStore,
  MemoryOpportunityStore,
  type CompanyDossier,
} from "@bgo/commercial";

const makeDossier = (cnpj: string, razaoSocial: string, score = 72): CompanyDossier => ({
  company: {
    cnpj,
    razaoSocial,
    nomeFantasia: "Fantasia B2B",
    cnae: "6201-5/01",
    porte: "MEDIO",
    situacao: "ATIVA",
    municipio: "São Paulo",
    uf: "SP",
    fonte: "csv-homologacao",
    importadoEm: "2026-11-13T12:00:00.000Z",
  },
  score,
  reasons: ["Situação ATIVA (+25)", "Porte MEDIO (+20)", "CNAE 6201-5/01 (+15)", "UF SP (+12)"],
  gaps: ["Confirmar decisor comercial"],
  simulated: false,
});

describe("MemoryOpportunityStore & Regras do Pipeline (Onda 11 / G131-G134)", () => {
  it("bloqueia criação de oportunidade para empresa pendente, rejeitada ou inexistente", async () => {
    const companies = new MemoryCompanyStore();
    const opps = new MemoryOpportunityStore(companies, "ws_test");

    await expect(
      opps.promoteCompany({
        companyId: "inexistente",
        approvedBy: "user:op",
        justification: "teste",
        correlationId: "corr-1",
      }),
    ).rejects.toThrow(/empresa não encontrada/);

    const batch = await companies.createImportBatch({
      fonte: "csv-test",
      correlationId: "corr-b1",
      totalRows: 1,
      imported: 1,
      duplicates: 0,
      rejected: 0,
      importedBy: "user:op",
    });
    await companies.upsertCompanies(batch.id, [makeDossier("11222333000181", "ALFA LTDA", 75)]);
    const co = (await companies.listCompanies({})).items[0]!;

    // Ainda pending -> deve falhar
    await expect(
      opps.promoteCompany({
        companyId: co.id,
        approvedBy: "user:op",
        justification: "tentativa sem aprovar",
        correlationId: "corr-2",
      }),
    ).rejects.toThrow(/precisa estar aprovada/);

    // Rejeitada -> deve falhar
    await companies.reviewCompany(co.id, "rejected", "user:op", "fora do perfil");
    await expect(
      opps.promoteCompany({
        companyId: co.id,
        approvedBy: "user:op",
        justification: "tentativa rejeitada",
        correlationId: "corr-3",
      }),
    ).rejects.toThrow(/precisa estar aprovada/);
  });

  it("promove empresa aprovada preservando proveniência e garante idempotência sob concorrência (G132/G133)", async () => {
    const companies = new MemoryCompanyStore();
    const opps = new MemoryOpportunityStore(companies, "ws_test");

    const batch = await companies.createImportBatch({
      fonte: "base-autorizada-b2b",
      correlationId: "corr-b2",
      totalRows: 1,
      imported: 1,
      duplicates: 0,
      rejected: 0,
      importedBy: "user:op",
    });
    await companies.upsertCompanies(batch.id, [makeDossier("11222333000181", "ALFA TECH LTDA", 82)]);
    const co = (await companies.listCompanies({})).items[0]!;
    await companies.reviewCompany(co.id, "approved", "user:approver", "aderente ao ICP");

    // 15 chamadas concorrentes (duplo clique / retry / corrida)
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, idx) =>
        opps.promoteCompany({
          companyId: co.id,
          approvedBy: "user:approver",
          justification: "Aprovada para prospecção Onda 11",
          correlationId: `corr-conc-${idx}`,
        }),
      ),
    );

    const createdCount = results.filter((r) => r.created).length;
    const duplicateCount = results.filter((r) => r.duplicate).length;
    expect(createdCount).toBe(1);
    expect(duplicateCount).toBe(14);

    const uniqueIds = new Set(results.map((r) => r.opportunity.id));
    expect(uniqueIds.size).toBe(1);

    const opp = results[0]!.opportunity;
    expect(opp.companyId).toBe(co.id);
    expect(opp.stage).toBe("approved_target");
    expect(opp.icpScore).toBe(82);
    expect(opp.priority).toBe("critical");
    expect(opp.source).toBe("scout:csv-homologacao");
    expect(opp.approvedBy).toBe("user:approver");
    expect(opp.justification).toBe("Aprovada para prospecção Onda 11");

    const history = await opps.opportunityHistory(opp.id);
    expect(history.length).toBe(1);
    expect(history[0]!.action).toBe("created");
    expect(history[0]!.details?.batchId).toBe(batch.id);
  });

  it("valida transições de estágio comercial e exige motivo para lost e archived (G134)", async () => {
    expect(() => assertOpportunityTransition("approved_target", "researching")).not.toThrow();
    expect(() => assertOpportunityTransition("approved_target", "won")).toThrow(InvalidOpportunityTransition);
    expect(() => assertOpportunityTransition("qualified", "lost")).toThrow(/exige motivo/);
    expect(() => assertOpportunityTransition("qualified", "archived", "   ")).toThrow(/exige motivo/);
    expect(() => assertOpportunityTransition("qualified", "lost", "Sem orçamento no trimestre")).not.toThrow();
  });

  it("aplica regra determinística de teto de prioridade por score ICP (G136)", () => {
    expect(maxPriorityForScore(85)).toBe("critical");
    expect(maxPriorityForScore(70)).toBe("high");
    expect(maxPriorityForScore(50)).toBe("normal");
    expect(maxPriorityForScore(25)).toBe("low");

    const allowed = checkPriorityRule(50, "normal");
    expect(allowed.allowedDirect).toBe(true);

    const blocked = checkPriorityRule(50, "critical");
    expect(blocked.allowedDirect).toBe(false);
    expect(blocked.maxAllowed).toBe("normal");
    expect(blocked.reason).toContain("Central de Aprovações");
  });
});
