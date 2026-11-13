import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { Store } from "@bgo/commercial";

const CSV = `cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf
11.222.333/0001-81,Empresa Alfa LTDA,Alfa,62.01-5-01,DEMAIS,MATRIZ ATIVA,Sao Paulo,SP
99887766000105,Empresa Beta SA,,70.20-4-00,EPP,ATIVA,Campinas,SP`;

function makeApp() {
  return buildApp({ store: new Store(), devAuth: true, persistence: "memory" });
}

const auth = { "x-bgo-user": "user:op", "x-bgo-role": "operator" };

describe("Central Scout — API (G111-G115)", () => {
  it("importa CSV persistindo lote+empresas, deduplica e lista com filtros", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST", url: "/api/scout/import",
      headers: auth,
      payload: { csv: CSV, fonte: "csv-homologacao", filename: "empresas.csv" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.imported).toBe(2);
    expect(body.batchId).toBeTruthy();
    expect(body.persisted.inserted).toBe(2);

    // reimportação idempotente
    const res2 = await app.inject({
      method: "POST", url: "/api/scout/import",
      headers: auth,
      payload: { csv: CSV, fonte: "csv-homologacao" },
    });
    expect(res2.json().persisted).toEqual({ inserted: 0, duplicates: 2 });

    const list = await app.inject({ method: "GET", url: "/api/scout/companies?uf=SP", headers: auth });
    expect(list.json().total).toBe(2);
    const batches = await app.inject({ method: "GET", url: "/api/scout/imports", headers: auth });
    expect(batches.json().length).toBe(2);
    await app.close();
  });

  it("revisão humana aprova empresa e exporta somente aprovadas", async () => {
    const app = makeApp();
    await app.inject({ method: "POST", url: "/api/scout/import", headers: auth, payload: { csv: CSV, fonte: "csv" } });
    const list = await app.inject({ method: "GET", url: "/api/scout/companies", headers: auth });
    const id = list.json().items[0].id as string;

    const denied = await app.inject({
      method: "POST", url: `/api/scout/companies/${id}/review`,
      headers: { "x-bgo-user": "u", "x-bgo-role": "auditor" },
      payload: { decision: "approved" },
    });
    expect(denied.statusCode).toBe(403);

    const ok = await app.inject({
      method: "POST", url: `/api/scout/companies/${id}/review`,
      headers: auth,
      payload: { decision: "approved", reason: "fit ICP" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().reviewStatus).toBe("approved");

    const detail = await app.inject({ method: "GET", url: `/api/scout/companies/${id}`, headers: auth });
    expect(detail.json().history.map((h: { action: string }) => h.action)).toContain("review_approved");

    const csv = await app.inject({ method: "GET", url: "/api/scout/export", headers: auth });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body).toContain("Empresa");
    await app.close();
  });
});

describe("Custos de IA — API (G95/G96/G117/G118)", () => {
  it("diagnóstico simulado registra uso consultável em /api/costs", async () => {
    const app = makeApp();
    const res = await app.inject({
      method: "POST", url: "/api/ai/meridian-diagnose",
      headers: auth,
      payload: { lead: { name: "Teste", company: "X" }, missionId: "m-custo-1" },
    });
    expect(res.statusCode).toBe(200);
    // sink é fire-and-forget — aguarda microtask
    await new Promise((r) => setTimeout(r, 20));
    const costs = await app.inject({ method: "GET", url: "/api/costs?missionId=m-custo-1", headers: auth });
    expect(costs.statusCode).toBe(200);
    const body = costs.json();
    expect(body.usage.total).toBe(1);
    expect(body.usage.items[0].simulated).toBe(true);
    expect(body.usage.items[0].agentId).toBe("meridian");
    expect(body.budget.daily.used).toBe(0); // simulado não consome orçamento real
    await app.close();
  });
});
