import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { Store } from "@bgo/commercial";

const CSV_VALID = [
  "cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf",
  "11.222.333/0001-81,ALFA SISTEMAS B2B LTDA,Alfa Cloud,6201-5/01,MEDIO,ATIVA,Sao Paulo,SP",
].join("\n");

const headersOp = { "x-bgo-user": "user:operator_1", "x-bgo-role": "operator" };

describe("Onda 16 — IA supervisionada dentro do pipeline de missões", () => {
  it("scout/beacon/pledge executam agentTask no run e registram aiAssist sem quebrar o fluxo determinístico", async () => {
    const app = buildApp({ store: new Store(), devAuth: true, persistence: "memory" });

    await app.inject({
      method: "POST",
      url: "/api/scout/import",
      headers: headersOp,
      payload: { csv: CSV_VALID, fonte: "csv-onda16" },
    });
    const company = (await app.inject({ method: "GET", url: "/api/scout/companies", headers: headersOp })).json().items[0] as { id: string };

    await app.inject({
      method: "POST",
      url: `/api/scout/companies/${company.id}/review`,
      headers: headersOp,
      payload: { decision: "approved" },
    });
    const oppRes = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${company.id}/opportunity`,
      headers: headersOp,
      payload: { justification: "Missão Onda 16" },
    });
    expect(oppRes.statusCode).toBe(201);
    const oppId = oppRes.json().opportunity.id as string;

    const missionRes = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/mission`,
      headers: headersOp,
      payload: {},
    });
    expect(missionRes.statusCode).toBe(200);
    const mBody = missionRes.json();
    expect(mBody.mission.status).toBe("awaiting_approval");
    expect(mBody.draft.status).toBe("draft");
    expect(mBody.opportunity.stage).toBe("awaiting_approval");

    const runsByAgent = new Map(mBody.runs.map((r: { agentId: string; output: Record<string, unknown> }) => [r.agentId, r]));
    for (const agentId of ["scout", "beacon", "pledge"]) {
      const run = runsByAgent.get(agentId) as { output: Record<string, unknown> } | undefined;
      expect(run, `run do agente ${agentId}`).toBeTruthy();
      const aiAssist = run!.output.aiAssist as Record<string, unknown> | undefined;
      expect(aiAssist, `aiAssist em ${agentId}`).toBeTruthy();
      expect(aiAssist!.simulated).toBe(true); // gateway em modo simulado nos testes
      expect(typeof aiAssist!.provider).toBe("string");
      expect(typeof aiAssist!.model).toBe("string");
      expect(aiAssist!.promptKey === undefined || typeof aiAssist!.promptKey === "string").toBe(true);
    }

    // aiAssist do pledge nunca remove os próximos passos determinísticos
    const pledgeRun = runsByAgent.get("pledge") as { output: { nextSteps: string[] } };
    expect(pledgeRun.output.nextSteps.some((s) => s.includes("Central de Aprovações"))).toBe(true);

    // meridian continua via diagnoseHook (diagnóstico existente preservado)
    const meridianRun = runsByAgent.get("meridian") as { output: { simulated: boolean } };
    expect(typeof meridianRun.output.simulated).toBe("boolean");

    await app.close();
  });
});
