import { describe, expect, it } from "vitest";
import {
  companiesToCsv,
  MemoryCompanyStore,
  sanitizeCsvCell,
  type CompanyDossier,
  type StoredCompany,
} from "@bgo/commercial";

const dossier = (cnpj: string, razao: string, score = 50, uf = "SP"): CompanyDossier => ({
  company: {
    cnpj,
    razaoSocial: razao,
    cnae: "4711301",
    porte: "MEDIA EMPRESA",
    situacao: "ATIVA",
    municipio: "São Paulo",
    uf,
    fonte: "csv-upload",
    importadoEm: "2026-11-13T00:00:00.000Z",
  },
  score,
  reasons: ["situação cadastral ativa"],
  gaps: [],
  simulated: false,
});

const CNPJ_A = "11222333000181";
const CNPJ_B = "99887766000105";

describe("MemoryCompanyStore — persistência e dedup (G111/G112)", () => {
  it("importa lote, deduplica por CNPJ e é idempotente na reimportação", async () => {
    const s = new MemoryCompanyStore();
    const b1 = await s.createImportBatch({
      fonte: "csv-teste", correlationId: "c1", totalRows: 2, imported: 2,
      duplicates: 0, rejected: 0, importedBy: "user:test",
    });
    const r1 = await s.upsertCompanies(b1.id, [dossier(CNPJ_A, "Alpha"), dossier(CNPJ_B, "Beta", 80)]);
    expect(r1).toEqual({ inserted: 2, duplicates: 0 });

    // reimportação do mesmo CSV: zero inserts, duplicatas contabilizadas
    const b2 = await s.createImportBatch({
      fonte: "csv-teste", correlationId: "c2", totalRows: 2, imported: 2,
      duplicates: 0, rejected: 0, importedBy: "user:test",
    });
    const r2 = await s.upsertCompanies(b2.id, [dossier(CNPJ_A, "Alpha"), dossier(CNPJ_B, "Beta", 80)]);
    expect(r2).toEqual({ inserted: 0, duplicates: 2 });

    const page = await s.listCompanies({});
    expect(page.total).toBe(2);
    const hist = await s.companyHistory(page.items[0]!.id);
    expect(hist.some((h) => h.action === "reimport_seen")).toBe(true);
  });

  it("filtra por score, UF, município e status de revisão", async () => {
    const s = new MemoryCompanyStore();
    const b = await s.createImportBatch({
      fonte: "csv", correlationId: "c", totalRows: 3, imported: 3,
      duplicates: 0, rejected: 0, importedBy: "u",
    });
    await s.upsertCompanies(b.id, [
      dossier(CNPJ_A, "Alpha", 90, "SP"),
      dossier(CNPJ_B, "Beta", 40, "RJ"),
      { ...dossier("12345678000195", "Gamma", 70, "MG"), company: { ...dossier("12345678000195", "Gamma", 70, "MG").company, municipio: "Belo Horizonte" } },
    ]);
    expect((await s.listCompanies({ minScore: 60 })).total).toBe(2);
    expect((await s.listCompanies({ uf: "rj" })).total).toBe(1);
    expect((await s.listCompanies({ municipio: "belo" })).total).toBe(1);
    expect((await s.listCompanies({ reviewStatus: "pending" })).total).toBe(3);
    expect((await s.listCompanies({ q: "alpha" })).total).toBe(1);
  });

  it("revisão humana registra responsável, motivo e histórico", async () => {
    const s = new MemoryCompanyStore();
    const b = await s.createImportBatch({
      fonte: "csv", correlationId: "c", totalRows: 1, imported: 1,
      duplicates: 0, rejected: 0, importedBy: "u",
    });
    await s.upsertCompanies(b.id, [dossier(CNPJ_A, "Alpha")]);
    const { items } = await s.listCompanies({});
    const id = items[0]!.id;
    const reviewed = await s.reviewCompany(id, "approved", "user:op", "fit ICP confirmado");
    expect(reviewed.reviewStatus).toBe("approved");
    expect(reviewed.reviewedBy).toBe("user:op");
    const hist = await s.companyHistory(id);
    expect(hist.map((h) => h.action)).toEqual(["imported", "review_approved"]);
    expect((await s.listCompanies({ reviewStatus: "approved" })).total).toBe(1);
  });
});

describe("export CSV — formula injection", () => {
  it("sanitiza células iniciadas por = + - @", () => {
    expect(sanitizeCsvCell("=HYPERLINK(x)")).toBe("'=HYPERLINK(x)");
    expect(sanitizeCsvCell("+cmd")).toBe("'+cmd");
    expect(sanitizeCsvCell("normal")).toBe("normal");
    const csv = companiesToCsv([{
      id: "1", cnpj: CNPJ_A, razaoSocial: "=Evil", fonte: "csv", importadoEm: "2026-01-01",
      score: 10, scoreVersion: "v1", reasons: [], gaps: [], reviewStatus: "approved",
      createdAt: "", updatedAt: "",
    } as StoredCompany]);
    expect(csv).toContain("'=Evil");
    expect(csv).not.toContain('"=Evil"');
  });
});
