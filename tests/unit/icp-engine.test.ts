import { describe, expect, it } from "vitest";
import {
  evaluateCompanyIcp,
  compareIcpEvaluation,
  DEFAULT_COMMERCIAL_ICP_PROFILE,
  type CommercialIcpProfile,
} from "@bgo/commercial";

describe("Motor de ICP Dinâmico e Versionado (G150-G153)", () => {
  const sampleCompany = {
    razaoSocial: "Alfa Sistemas de Gestão Ltda",
    nomeFantasia: "Alfa Cloud",
    cnpj: "12.345.678/0001-90",
    cnae: "62.01-5-01",
    porte: "MEDIO",
    situacao: "ATIVA",
    municipio: "Curitiba",
    uf: "PR",
  };

  it("calcula score de aderência respeitando inclusões e pesos", () => {
    const result = evaluateCompanyIcp(sampleCompany, DEFAULT_COMMERCIAL_ICP_PROFILE);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.excluded).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.icpVersion).toBe(DEFAULT_COMMERCIAL_ICP_PROFILE.version);
    // Honestidade de estado: disclaimer obrigatório
    expect(result.disclaimer).toContain("Não representa prova nem garantia de intenção de compra");
  });

  it("aplica regras de exclusão estritas com score 0 e justificativa explícita", () => {
    const baixadaCompany = {
      ...sampleCompany,
      situacao: "BAIXADA",
    };

    const result = evaluateCompanyIcp(baixadaCompany, DEFAULT_COMMERCIAL_ICP_PROFILE);
    expect(result.excluded).toBe(true);
    expect(result.score).toBe(0);
    expect(result.exclusionReason).toContain("Receita Federal");
  });

  it("recalibra score conforme pesos customizados", () => {
    const partialMatchCompany = {
      ...sampleCompany,
      uf: "AM", // fora dos UFs prioritários (Sul/Sudeste)
      nomeFantasia: undefined,
    };

    const lowCnaeProfile: CommercialIcpProfile = {
      ...DEFAULT_COMMERCIAL_ICP_PROFILE,
      id: "icp-low-cnae",
      version: 3,
      weights: {
        cnae: 5,
        size: 40,
        location: 35,
        operation: 20,
      },
    };

    const resStandard = evaluateCompanyIcp(partialMatchCompany, DEFAULT_COMMERCIAL_ICP_PROFILE);
    const resCalibrated = evaluateCompanyIcp(partialMatchCompany, lowCnaeProfile);

    expect(resCalibrated.score).not.toEqual(resStandard.score);
    expect(resCalibrated.icpVersion).toBe(3);
  });

  it("compara resultados entre versões de ICP de forma determinística", () => {
    const v1 = DEFAULT_COMMERCIAL_ICP_PROFILE;
    const v2: CommercialIcpProfile = {
      ...DEFAULT_COMMERCIAL_ICP_PROFILE,
      version: 2,
      weights: {
        cnae: 10,
        size: 20,
        location: 20,
        operation: 50,
      },
    };

    const comp = compareIcpEvaluation(sampleCompany, v1, v2);
    expect(comp.profileA.version).toBe(1);
    expect(comp.profileB.version).toBe(2);
    expect(comp.scoreDifference).toEqual(comp.profileB.score - comp.profileA.score);
  });
});
