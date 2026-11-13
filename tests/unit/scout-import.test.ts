import { describe, expect, it } from "vitest";
import { importCompaniesCsv, isValidCnpj, normalizeCnpj } from "@bgo/commercial";

const CSV = `cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf
11.222.333/0001-81,Empresa Alfa LTDA,Alfa,62.01-5-01,DEMAIS,MATRIZ ATIVA,Sao Paulo,SP
99887766000105,Empresa Beta SA,,70.20-4-00,EPP,ATIVA,Campinas,SP
00000000000000,Invalida SA,,,-,ATIVA,X,XX
11.222.333/0001-81,Duplicada LTDA,,,,-,Y,YY`;

describe("Scout CSV import (G92-G94)", () => {
  it("valida CNPJ por dígitos verificadores", () => {
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizeCnpj("abc")).toBeNull();
  });
  it("importa, deduplica por CNPJ e rejeita inválidos", () => {
    const r = importCompaniesCsv(CSV, { fonte: "teste", importadoEm: "2026-01-01T00:00:00Z" });
    expect(r.imported).toBe(2);
    expect(r.duplicates).toBe(1);
    expect(r.rejected.length).toBeGreaterThanOrEqual(1);
    expect(r.dossiers[0].company.fonte).toBe("teste");
    expect(r.dossiers[0].simulated).toBe(false);
    expect(r.dossiers[0].score).toBeGreaterThan(0);
    expect(r.dossiers.every((d) => d.reasons.length > 0 || d.gaps.length > 0)).toBe(true);
  });
  it("rejeita CSV sem colunas obrigatórias", () => {
    const r = importCompaniesCsv("foo,bar\n1,2", { fonte: "x" });
    expect(r.imported).toBe(0);
    expect(r.rejected[0].reason).toContain("cnpj");
  });
});
