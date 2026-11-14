import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import {
  Store,
} from "@bgo/commercial";
import {
  PrismaIcpStore,
  PrismaCommunicationSandboxStore,
  PrismaOfferCatalogStore,
  prisma as getPrisma,
} from "@bgo/db";
import type { CommercialIcpProfile, CommercialOfferItem, CommunicationDispatch } from "@bgo/contracts";

const headersOp = { "x-bgo-user": "user:operator_1", "x-bgo-role": "operator" };
const headersApprover = { "x-bgo-user": "user:approver_1", "x-bgo-role": "approver" };

function createTestApp() {
  return buildApp({
    store: new Store(),
    devAuth: true,
    persistence: "memory",
  });
}

describe("Onda 12 — ICP Dinâmico, Ativação Controlada, Inteligência Cooperativa e Sandbox (G150-G164)", () => {
  it("G150-G153: Gerencia ciclo de vida do ICP dinâmico, versionamento, aprovação supervisionada e comparação", async () => {
    const app = createTestApp();

    // 1. Lista perfis existentes (perfil inicial aprovado v1)
    const listRes = await app.inject({
      method: "GET",
      url: "/api/icp/profiles",
      headers: headersOp,
    });
    expect(listRes.statusCode).toBe(200);
    const profiles = listRes.json().profiles;
    expect(profiles.length).toBeGreaterThanOrEqual(1);

    // 2. Busca perfil ativo/aprovado
    const activeRes = await app.inject({
      method: "GET",
      url: "/api/icp/active",
      headers: headersOp,
    });
    expect(activeRes.statusCode).toBe(200);
    const active = activeRes.json();
    expect(active.status).toBe("approved");
    expect(active.version).toBe(1);

    // 3. Cria novo perfil rascunho
    const createRes = await app.inject({
      method: "POST",
      url: "/api/icp/profiles",
      headers: headersOp,
      payload: {
        name: "ICP Farmácias Expansão",
        description: "Foco em redes de drogarias no Paraná",
        weights: { cnae: 40, size: 25, location: 25, operation: 10 },
        inclusions: [
          { id: "inc-1", name: "CNAE Drogaria", weight: 40, condition: "cnae_alvo" },
        ],
        exclusions: [
          { id: "exc-1", name: "Empresa Inativa", condition: "situacao_inativa", reason: "Empresa inativa na RF" },
        ],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const newProfile = createRes.json();
    expect(newProfile.status).toBe("draft");
    expect(newProfile.version).toBe(1);

    // 4. Submete para aprovação humana (G152)
    const submitRes = await app.inject({
      method: "POST",
      url: `/api/icp/profiles/${newProfile.id}/submit-approval`,
      headers: headersOp,
    });
    expect(submitRes.statusCode).toBe(201);
    const { approval } = submitRes.json();
    expect(approval.id).toBeDefined();
    expect(approval.action).toBe("icp.activate");

    // 5. Decisão de aprovação pelo aprovador
    const decideRes = await app.inject({
      method: "POST",
      url: `/api/approvals/${approval.id}/decide`,
      headers: headersApprover,
      payload: { decision: "approved", reason: "Alinhado com estratégia Q4" },
    });
    expect(decideRes.statusCode).toBe(200);

    // 6. Confirma que o novo perfil se tornou aprovado
    const activeAfter = await app.inject({
      method: "GET",
      url: "/api/icp/active",
      headers: headersOp,
    });
    expect(activeAfter.statusCode).toBe(200);
    expect(activeAfter.json().id).toBe(newProfile.id);
    expect(activeAfter.json().status).toBe("approved");

    // 7. Comparação de resultados entre perfis (G153)
    const compareRes = await app.inject({
      method: "POST",
      url: "/api/icp/compare",
      headers: headersOp,
      payload: {
        profileAId: active.id,
        profileBId: newProfile.id,
        companyData: {
          razaoSocial: "Farmácia Boa Esperança",
          cnae: "4771-7/01",
          porte: "MPE",
          situacao: "ATIVA",
          municipio: "Curitiba",
          uf: "PR",
        },
      },
    });
    expect(compareRes.statusCode).toBe(200);
    const comp = compareRes.json();
    expect(comp.profileA.version).toBe(active.version);
    expect(comp.profileB.version).toBe(newProfile.version);
    expect(comp.scoreDifference).toBeDefined();
  });

  it("G154: Mantém Meridian em modo determinístico e BLOQUEADO POR CREDENCIAL na ausência de chave real", async () => {
    const app = createTestApp();

    const health = await app.inject({
      method: "GET",
      url: "/api/health",
      headers: headersOp,
    });
    expect(health.statusCode).toBe(200);
    expect(health.json().simulated).toBe(true);

    // Na ausência de BGO_AI_API_KEY, nenhuma inferência real é realizada e nenhum crédito pago é consumido
    expect(process.env.BGO_AI_API_KEY).toBeUndefined();
  });

  it("G155-G158: Central de Comunicação Supervisionada e Sandbox com simulação de cenários, opt-out e idempotência", async () => {
    const app = createTestApp();

    // 1. Despacho bem-sucedido no sandbox
    const corrId = "sandbox-corr-test-1";
    const dispatchSuccess = await app.inject({
      method: "POST",
      url: "/api/communication/sandbox/dispatch",
      headers: headersOp,
      payload: {
        channel: "email",
        recipient: "diretoria@cliente-sintetico.com.br",
        subject: "Apresentação Solução BGO",
        content: "Proposta preliminar de automação comercial.",
        scenario: "success",
        correlationId: corrId,
      },
    });
    expect(dispatchSuccess.statusCode).toBe(201);
    const bodySucc = dispatchSuccess.json();
    expect(bodySucc.dispatch.status).toBe("sent_simulated");
    expect(bodySucc.dispatch.simulated).toBe(true);
    expect(bodySucc.duplicated).toBe(false);
    expect(bodySucc.simulatedPayload.headers["X-BGO-Sandbox"]).toBe("true");

    // 2. Idempotência estrita (segundo disparo com mesmo correlationId)
    const dispatchDup = await app.inject({
      method: "POST",
      url: "/api/communication/sandbox/dispatch",
      headers: headersOp,
      payload: {
        channel: "email",
        recipient: "diretoria@cliente-sintetico.com.br",
        subject: "Apresentação Solução BGO",
        content: "Proposta preliminar repetida.",
        scenario: "success",
        correlationId: corrId,
      },
    });
    expect(dispatchDup.statusCode).toBe(200);
    expect(dispatchDup.json().duplicated).toBe(true);
    expect(dispatchDup.json().dispatch.id).toBe(bodySucc.dispatch.id);

    // 3. Simulação de falha controlada (network_timeout)
    const dispatchTimeout = await app.inject({
      method: "POST",
      url: "/api/communication/sandbox/dispatch",
      headers: headersOp,
      payload: {
        channel: "whatsapp",
        recipient: "+5511988887777",
        content: "Teste de falha de conexão",
        scenario: "network_timeout",
      },
    });
    expect(dispatchTimeout.statusCode).toBe(201);
    expect(dispatchTimeout.json().dispatch.status).toBe("error_simulated");

    // 4. Lista disparos registrados para auditoria
    const listDisp = await app.inject({
      method: "GET",
      url: "/api/communication/dispatches",
      headers: headersOp,
    });
    expect(listDisp.statusCode).toBe(200);
    expect(listDisp.json().total).toBeGreaterThanOrEqual(2);
  });

  it("G157: Governança de Oferta Comercial — impede uso de claims pendentes e valida itens aprovados", async () => {
    const app = createTestApp();

    // 1. Lista catálogo de ofertas
    const catRes = await app.inject({
      method: "GET",
      url: "/api/offer-catalog",
      headers: headersOp,
    });
    expect(catRes.statusCode).toBe(200);
    const items = catRes.json().items;
    expect(items.length).toBeGreaterThanOrEqual(4);

    // 2. Cria nova alegação comercial (status 'pending_validation')
    const createItem = await app.inject({
      method: "POST",
      url: "/api/offer-catalog",
      headers: headersOp,
      payload: {
        category: "differentiator",
        title: "Garantia de Uptime 99.9%",
        content: "Disponibilidade com failover multi-região comprovada em contrato.",
        evidenceUrl: "https://synthetic.local/sla-contract.pdf",
      },
    });
    expect(createItem.statusCode).toBe(201);
    const newItem = createItem.json();
    expect(newItem.status).toBe("pending_validation");

    // 3. Validação de claims bloqueia o item pendente
    const valBlocked = await app.inject({
      method: "POST",
      url: "/api/offer-catalog/validate-claims",
      headers: headersOp,
      payload: { claimRefs: [newItem.id] },
    });
    expect(valBlocked.statusCode).toBe(200);
    expect(valBlocked.json().valid).toBe(false);
    expect(valBlocked.json().pendingClaims).toContain(newItem.id);

    // 4. Submete para aprovação humana na Central de Aprovações
    const submitAppr = await app.inject({
      method: "POST",
      url: `/api/offer-catalog/${newItem.id}/submit-approval`,
      headers: headersOp,
    });
    expect(submitAppr.statusCode).toBe(201);
    const approvalId = submitAppr.json().approval.id;

    // 5. Aprovador autoriza o claim comercial
    const decideAppr = await app.inject({
      method: "POST",
      url: `/api/approvals/${approvalId}/decide`,
      headers: headersApprover,
      payload: { decision: "approved", reason: "SLA validado pelo jurídico" },
    });
    expect(decideAppr.statusCode).toBe(200);

    // 6. Agora a validação de claims aprova o uso do item
    const valApproved = await app.inject({
      method: "POST",
      url: "/api/offer-catalog/validate-claims",
      headers: headersOp,
      payload: { claimRefs: [newItem.id] },
    });
    expect(valApproved.statusCode).toBe(200);
    expect(valApproved.json().valid).toBe(true);
    expect(valApproved.json().approvedClaims.map((c: any) => c.id)).toContain(newItem.id);
  });

  it("G159-G163: Missão cooperativa dos 6 agentes emite fatos, inferências, recomendações e valida claims de oferta", async () => {
    const app = createTestApp();

    // 1. Cria empresa e oportunidade aprovada
    const CSV_SAMPLE = "cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf\n11.222.333/0001-81,DROGARIA EXEMPLO S.A.,Drogaria Exemplo,6201-5/01,MEDIO,ATIVA,Londrina,PR";
    const imp = await app.inject({
      method: "POST",
      url: "/api/scout/import",
      headers: headersOp,
      payload: { csv: CSV_SAMPLE, fonte: "csv-receita", filename: "onda12_sample.csv" },
    });
    expect(imp.statusCode).toBe(200);

    const compList = await app.inject({ method: "GET", url: "/api/scout/companies", headers: headersOp });
    const comp = compList.json().items[0];

    // Operador aprova a empresa
    await app.inject({
      method: "POST",
      url: `/api/scout/companies/${comp.id}/review`,
      headers: headersOp,
      payload: { decision: "approved" },
    });

    // Cria oportunidade comercial
    const oppRes = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${comp.id}/opportunity`,
      headers: headersOp,
      payload: { justification: "Oportunidade para expansão comercial Onda 12" },
    });
    expect(oppRes.statusCode).toBe(201);
    const opp = oppRes.json().opportunity;

    // 2. Executa a missão comercial dos 6 agentes
    const missionRes = await app.inject({
      method: "POST",
      url: `/api/opportunities/${opp.id}/mission`,
      headers: headersOp,
    });
    expect(missionRes.statusCode).toBe(200);
    const missionBody = missionRes.json();

    // 3. Validação de saída estruturada (G156 / G159)
    expect(missionBody.structuredOutput).toBeDefined();
    expect(missionBody.structuredOutput.facts.length).toBeGreaterThan(0);
    expect(missionBody.structuredOutput.inferences.length).toBeGreaterThan(0);
    expect(missionBody.structuredOutput.recommendations.length).toBeGreaterThan(0);

    // 4. Validação de perfil ICP dinâmico aplicado
    expect(missionBody.icpProfile).toBeDefined();
    expect(missionBody.icpProfile.version).toBeGreaterThanOrEqual(1);

    // 5. Validação de rascunho com claims aprovados (G157)
    expect(missionBody.draft.claimRefs.length).toBeGreaterThan(0);
    expect(missionBody.approval).toBeDefined();
    expect(missionBody.simulated).toBe(true);
  });

  it("G164: Persistência nativa PostgreSQL dos modelos Onda 12 (PrismaIcpStore, PrismaCommunicationSandboxStore, PrismaOfferCatalogStore)", async () => {
    const prisma = getPrisma();
    const icpStore = new PrismaIcpStore(prisma);
    const sandboxStore = new PrismaCommunicationSandboxStore(prisma);
    const offerStore = new PrismaOfferCatalogStore(prisma);

    const ws = "ws_default";

    // 1. Testa PrismaIcpStore
    const pgTestName = `ICP Postgres Integration Test ${Date.now()}`;
    const icpProfileToCreate: CommercialIcpProfile = {
      id: `icp_pg_${Date.now()}`,
      workspaceId: ws,
      name: pgTestName,
      description: "Teste de persistência nativa PG",
      version: 1,
      status: "draft",
      targetSegments: ["Tecnologia"],
      targetCnaes: ["62.01-5-01"],
      targetSizes: ["MEDIO"],
      targetUfs: ["PR"],
      weights: { cnae: 30, size: 30, location: 20, operation: 20 },
      inclusions: [{ id: "i1", name: "Médio porte", weight: 30, condition: "porte_alvo" }],
      exclusions: [],
      createdBy: "test_pg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdIcp = await icpStore.createProfile(icpProfileToCreate);
    expect(createdIcp.id).toBeDefined();
    expect(createdIcp.version).toBe(1);

    const fetchedIcp = await icpStore.getProfile(createdIcp.id);
    expect(fetchedIcp?.name).toBe(pgTestName);

    // 2. Testa PrismaOfferCatalogStore
    const offerItemToCreate: CommercialOfferItem = {
      id: `offer_pg_${Date.now()}`,
      workspaceId: ws,
      category: "differentiator",
      title: "Autonomia Supervisionada PG",
      content: "Nenhum envio sem aprovação auditada no Postgres.",
      status: "pending_validation",
      version: "offer-v1",
      createdBy: "test_pg",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await offerStore.saveItem(offerItemToCreate);
    const savedOffer = await offerStore.getItem(offerItemToCreate.id);
    expect(savedOffer?.status).toBe("pending_validation");

    const approvedOffer = await offerStore.approveItem(offerItemToCreate.id, "approver_pg");
    expect(approvedOffer?.status).toBe("approved");

    // 3. Testa PrismaCommunicationSandboxStore
    const corrId = `pg-corr-${Date.now()}`;
    const dispatchToCreate: CommunicationDispatch = {
      id: `disp_pg_${Date.now()}`,
      workspaceId: ws,
      channel: "email",
      recipient: "contato@pg-test.local",
      subject: "Teste Postgres Dispatch",
      content: "Corpo do e-mail persistido no PostgreSQL.",
      status: "sent_simulated",
      simulated: true,
      dispatchedBy: "test_pg",
      correlationId: corrId,
      createdAt: new Date().toISOString(),
    };

    await sandboxStore.saveDispatch(dispatchToCreate);
    const fetchedDispatch = await sandboxStore.getDispatchByCorrelation(ws, corrId);
    expect(fetchedDispatch?.recipient).toBe("contato@pg-test.local");
    expect(fetchedDispatch?.status).toBe("sent_simulated");
  });
});
