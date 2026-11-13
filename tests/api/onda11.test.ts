import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { MemoryCostStore, Store } from "@bgo/commercial";
import { PrismaCompanyStore, PrismaCostStore, PrismaOpportunityStore, PrismaStore, prisma as getPrisma } from "@bgo/db";

const CSV_VALID = [
  "cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf",
  "11.222.333/0001-81,ALFA SISTEMAS B2B LTDA,Alfa Cloud,6201-5/01,MEDIO,ATIVA,Sao Paulo,SP",
  "11.444.777/0001-61,BETA ANALYTICS S.A.,Beta Data,6202-3/00,EPP,ATIVA,Curitiba,PR",
].join("\n");

const headersOp = { "x-bgo-user": "user:operator_1", "x-bgo-role": "operator" };
const headersApprover = { "x-bgo-user": "user:approver_1", "x-bgo-role": "approver" };
const headersOwner = { "x-bgo-user": "user:owner_1", "x-bgo-role": "owner" };
const headersAuditor = { "x-bgo-user": "user:auditor_1", "x-bgo-role": "auditor" };

function createTestApp(costLimits?: { dailyUnits?: number; monthlyUnits?: number }, costStore?: MemoryCostStore) {
  return buildApp({
    store: new Store(),
    devAuth: true,
    persistence: "memory",
    ...(costStore ? { costStore } : {}),
    ...(costLimits ? { costLimits } : {}),
  });
}

describe("Onda 11 — Empresa → Oportunidade, 6 Agentes, Pipeline e Aprovações (G131-G136, G141)", () => {
  it("G131/G132/G133: promove somente empresa aprovada, preserva proveniência sem criar contato fictício e garante deduplicação concorrente", async () => {
    const app = createTestApp();

    // 1. Importa CSV na Central Scout
    const imp = await app.inject({
      method: "POST",
      url: "/api/scout/import",
      headers: headersOp,
      payload: { csv: CSV_VALID, fonte: "csv-receita-licenciado", filename: "lote11.csv" },
    });
    expect(imp.statusCode).toBe(200);
    const batchId = imp.json().batchId as string;
    expect(batchId).toBeTruthy();

    const listRes = await app.inject({
      method: "GET",
      url: "/api/scout/companies",
      headers: headersOp,
    });
    const company = listRes.json().items[0] as { id: string; cnpj: string; score: number };
    expect(company).toBeTruthy();

    // 2. Tentativa de promover empresa ainda pendente -> bloqueada (409)
    const blockedUnapproved = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${company.id}/opportunity`,
      headers: headersOp,
      payload: { justification: "tentativa prematura" },
    });
    expect(blockedUnapproved.statusCode).toBe(409);
    expect(blockedUnapproved.json().error).toContain("precisa estar aprovada");

    // 3. RBAC: auditor não pode aprovar nem promover empresa (403)
    const deniedAuditorReview = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${company.id}/review`,
      headers: headersAuditor,
      payload: { decision: "approved" },
    });
    expect(deniedAuditorReview.statusCode).toBe(403);

    // 4. Operador aprova a empresa na Central Scout
    const rev = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${company.id}/review`,
      headers: headersOp,
      payload: { decision: "approved", reason: "Fit ICP validado" },
    });
    expect(rev.statusCode).toBe(200);

    // Auditor ainda bloqueado na criação de oportunidade (403)
    const deniedAuditorOpp = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${company.id}/opportunity`,
      headers: headersAuditor,
      payload: { justification: "auditor tentando promover" },
    });
    expect(deniedAuditorOpp.statusCode).toBe(403);

    // 5. 10 chamadas concorrentes de criação de oportunidade (duplo clique / retry / corrida)
    const concurrentResponses = await Promise.all(
      Array.from({ length: 10 }, () =>
        app.inject({
          method: "POST",
          url: `/api/scout/companies/${company.id}/opportunity`,
          headers: headersOp,
          payload: { justification: "Aderência ICP confirmada — avançar para pipeline" },
        }),
      ),
    );

    const status201 = concurrentResponses.filter((r) => r.statusCode === 201);
    const status200 = concurrentResponses.filter((r) => r.statusCode === 200);
    expect(status201.length).toBe(1);
    expect(status200.length).toBe(9);

    const oppId = status201[0]!.json().opportunity.id as string;
    for (const r of concurrentResponses) {
      expect(r.json().opportunity.id).toBe(oppId);
    }

    // 6. Verifica proveniência completa e ausência de contato pessoal fictício
    const oppDetail = await app.inject({
      method: "GET",
      url: `/api/opportunities/${oppId}`,
      headers: headersOp,
    });
    expect(oppDetail.statusCode).toBe(200);
    const detailBody = oppDetail.json();
    expect(detailBody.opportunity.companyId).toBe(company.id);
    expect(detailBody.opportunity.source).toBe("scout:csv-receita-licenciado");
    expect(detailBody.opportunity.approvedBy).toBe("user:operator_1");
    expect(detailBody.opportunity.justification).toContain("Aderência ICP confirmada");
    expect(detailBody.company.batchId).toBe(batchId);
    expect(detailBody.history.length).toBe(1);
    expect(detailBody.history[0].action).toBe("created");

    const leadsRes = await app.inject({ method: "GET", url: "/api/leads", headers: headersOp });
    expect(leadsRes.json().length).toBe(0); // Nenhum lead ou contato pessoal fictício foi criado!

    await app.close();
  });

  it("G134/G135/G136: executa missão integrada dos 6 agentes, popula Pipeline e supervisiona ações na Central de Aprovações", async () => {
    const app = createTestApp();

    await app.inject({
      method: "POST",
      url: "/api/scout/import",
      headers: headersOp,
      payload: { csv: CSV_VALID, fonte: "csv-operador" },
    });
    const companies = (await app.inject({ method: "GET", url: "/api/scout/companies", headers: headersOp })).json().items;
    const companyA = companies[0] as { id: string };
    const companyB = companies[1] as { id: string };

    await app.inject({
      method: "POST",
      url: `/api/scout/companies/${companyA.id}/review`,
      headers: headersOp,
      payload: { decision: "approved" },
    });
    await app.inject({
      method: "POST",
      url: `/api/scout/companies/${companyB.id}/review`,
      headers: headersOp,
      payload: { decision: "approved" },
    });

    // Promoção direta de companyA
    const createdOppRes = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${companyA.id}/opportunity`,
      headers: headersOp,
      payload: { justification: "Oportunidade principal Onda 11" },
    });
    expect(createdOppRes.statusCode).toBe(201);
    const oppId = createdOppRes.json().opportunity.id as string;

    // Promoção supervisionada de companyB via requireApproval=true (Fase 05 item 1)
    const supervisedPromoteRes = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${companyB.id}/opportunity`,
      headers: headersOp,
      payload: { justification: "Promoção exigindo aprovação prévia", requireApproval: true },
    });
    expect(supervisedPromoteRes.statusCode).toBe(202);
    expect(supervisedPromoteRes.json().queuedForApproval).toBe(true);
    const promoteApprovalId = supervisedPromoteRes.json().approval.id as string;

    // Aprovador aprova a promoção de companyB -> oportunidade criada!
    const decidePromote = await app.inject({
      method: "POST",
      url: `/api/approvals/${promoteApprovalId}/decision`,
      headers: headersApprover,
      payload: { decision: "approved", reason: "Autorizado ingresso no pipeline" },
    });
    expect(decidePromote.statusCode).toBe(200);
    expect(decidePromote.json().opportunity).toBeTruthy();

    // Executa missão comercial dos 6 agentes na oppId (Fase 03 / G135)
    const missionRes = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/mission`,
      headers: headersOp,
      payload: {},
    });
    expect(missionRes.statusCode).toBe(200);
    const mBody = missionRes.json();
    expect(mBody.mission.opportunityId).toBe(oppId);
    expect(mBody.mission.companyId).toBe(companyA.id);
    expect(mBody.runs.map((r: { agentId: string }) => r.agentId)).toEqual([
      "aegis",
      "relay",
      "scout",
      "meridian",
      "beacon",
      "pledge",
    ]);
    for (const run of mBody.runs) {
      expect(run.status).toBe("completed");
      expect(typeof run.durationMs).toBe("number");
      expect(run.input).toBeTruthy();
      expect(run.output).toBeTruthy();
    }
    expect(mBody.draft.simulated).toBe(true);
    expect(mBody.draft.status).toBe("draft");
    expect(mBody.draft.claimRefs.length).toBeGreaterThan(0);
    expect(mBody.opportunity.stage).toBe("awaiting_approval");
    expect(mBody.opportunity.currentAgentId).toBe("pledge");

    // Idempotência da missão: repetir chamada sem forceNew retorna a mesma missão sem duplicar
    const missionDup = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/mission`,
      headers: headersOp,
      payload: {},
    });
    expect(missionDup.statusCode).toBe(200);
    expect(missionDup.json().duplicate).toBe(true);
    expect(missionDup.json().mission.id).toBe(mBody.mission.id);

    // Aprovação do rascunho na Central de Aprovações (Fase 05 item 3: aprovar rascunho não envia mensagem externa)
    const draftApprovalId = mBody.approval.id as string;
    const decideDraft = await app.inject({
      method: "POST",
      url: `/api/approvals/${draftApprovalId}/decision`,
      headers: headersApprover,
      payload: { decision: "approved", reason: "Rascunho validado sem envio automático" },
    });
    expect(decideDraft.statusCode).toBe(200);
    expect(decideDraft.json().opportunity.stage).toBe("followup_planned");
    const draftsAfter = (await app.inject({ method: "GET", url: "/api/drafts", headers: headersOp })).json();
    expect(draftsAfter.find((d: { id: string }) => d.id === mBody.draft.id)?.status).toBe("approved");

    // Transição inválida -> 409
    const invalidTrans = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/transition`,
      headers: headersOp,
      payload: { to: "researching" },
    });
    expect(invalidTrans.statusCode).toBe(409);

    // Transição para lost sem motivo -> 409
    const lostWithoutReason = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/transition`,
      headers: headersOp,
      payload: { to: "lost" },
    });
    expect(lostWithoutReason.statusCode).toBe(409);

    // Transição sensível com requireApproval=true (Fase 05 item 2)
    const sensitiveTrans = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/transition`,
      headers: headersOp,
      payload: { to: "won", reason: "Proposta aceita em comitê comercial", requireApproval: true },
    });
    expect(sensitiveTrans.statusCode).toBe(202);
    const sensitiveApprovalId = sensitiveTrans.json().approval.id as string;

    const decideSensitive = await app.inject({
      method: "POST",
      url: `/api/approvals/${sensitiveApprovalId}/decision`,
      headers: headersOwner,
      payload: { decision: "approved", reason: "Fechamento comercial validado pelo owner" },
    });
    expect(decideSensitive.statusCode).toBe(200);
    expect(decideSensitive.json().opportunity.stage).toBe("won");

    // Solicitação de atividade externa supervisionada (Fase 05 item 4)
    const extActivity = await app.inject({
      method: "POST",
      url: "/api/approvals/request",
      headers: headersOp,
      payload: {
        action: "external.activity_request",
        scope: `opportunity:${oppId}:meeting`,
        reason: "Agendar reunião externa com diretoria da conta",
      },
    });
    expect(extActivity.statusCode).toBe(201);
    const decideExt = await app.inject({
      method: "POST",
      url: `/api/approvals/${extActivity.json().id}/decision`,
      headers: headersApprover,
      payload: { decision: "approved", reason: "Atividade externa autorizada" },
    });
    expect(decideExt.statusCode).toBe(200);

    await app.close();
  });

  it("G136: bloqueia elevação de prioridade acima do teto determinístico e orçamento excedido exigindo aprovação humana", async () => {
    const costStore = new MemoryCostStore();
    // Insere uso real prévio de 10 units para testar bloqueio quando dailyUnits = 5
    await costStore.insertUsage({
      id: "usage_real_1",
      agentId: "meridian",
      provider: "openai-compatible",
      model: "gpt-4o-mini",
      simulated: false,
      tokensIn: 500,
      tokensOut: 500,
      costUnits: 10,
      estimatedCost: 0.01,
      billedCost: null,
      tariffVersion: null,
      durationMs: 120,
      status: "success",
      occurredAt: new Date().toISOString(),
    });

    const app = createTestApp({ dailyUnits: 5 }, costStore);

    // Importa empresa com score moderado (< 80) para testar regra de prioridade
    const csvLowScore = [
      "cnpj,razao_social,porte,situacao,uf",
      "11.222.333/0001-81,EMPRESA SCORE MODERADO LTDA,ME,ATIVA,RJ",
    ].join("\n");
    await app.inject({
      method: "POST",
      url: "/api/scout/import",
      headers: headersOp,
      payload: { csv: csvLowScore, fonte: "csv-mod" },
    });
    const co = (await app.inject({ method: "GET", url: "/api/scout/companies", headers: headersOp })).json().items[0];
    expect(co.score).toBeLessThan(80);

    await app.inject({
      method: "POST",
      url: `/api/scout/companies/${co.id}/review`,
      headers: headersOp,
      payload: { decision: "approved" },
    });
    const oppRes = await app.inject({
      method: "POST",
      url: `/api/scout/companies/${co.id}/opportunity`,
      headers: headersOp,
      payload: { justification: "Teste de prioridade e orçamento" },
    });
    const oppId = oppRes.json().opportunity.id as string;

    // 1. Mudança de prioridade para 'critical' contrariando regra determinística -> 202 queuedForApproval (Fase 05 item 5)
    const prioRes = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/priority`,
      headers: headersOp,
      payload: { priority: "critical", reason: "Conta estratégica prioritária" },
    });
    expect(prioRes.statusCode).toBe(202);
    expect(prioRes.json().queuedForApproval).toBe(true);
    const prioApprovalId = prioRes.json().approval.id as string;

    const decidePrio = await app.inject({
      method: "POST",
      url: `/api/approvals/${prioApprovalId}/decision`,
      headers: headersApprover,
      payload: { decision: "approved", reason: "Exceção de prioridade autorizada" },
    });
    expect(decidePrio.statusCode).toBe(200);
    expect(decidePrio.json().opportunity.priority).toBe("critical");

    // 2. Tentativa de missão com orçamento diário excedido -> 429 + budget.limit_override (Fase 05 item 6)
    const budgetBlockedRes = await app.inject({
      method: "POST",
      url: `/api/opportunities/${oppId}/mission`,
      headers: headersOp,
      payload: {},
    });
    expect(budgetBlockedRes.statusCode).toBe(429);
    expect(budgetBlockedRes.json().queuedForApproval).toBe(true);
    expect(budgetBlockedRes.json().approval.action).toBe("budget.limit_override");

    await app.close();
  });

  it("G140/G141: transação atômica PostgreSQL, concorrência e isolamento estrito por workspaceId", async () => {
    const prisma = getPrisma();
    const storeA = new PrismaStore(prisma);
    await storeA.init();
    const wsA = storeA.workspace.id;
    const companiesA = new PrismaCompanyStore(prisma, wsA);
    const oppsA = new PrismaOpportunityStore(prisma, wsA);
    const costsA = new PrismaCostStore(prisma, wsA);

    // Cria segundo workspace isolado (ws_beta)
    const wsBetaRow = await prisma.workspace.upsert({
      where: { slug: "birthub-growth-beta-test" },
      update: {},
      create: {
        slug: "birthub-growth-beta-test",
        name: "Workspace Beta Isolado",
        ownerId: "user_owner",
      },
    });
    const wsB = wsBetaRow.id;
    const companiesB = new PrismaCompanyStore(prisma, wsB);
    const oppsB = new PrismaOpportunityStore(prisma, wsB);

    // Limpa registros anteriores do CNPJ de teste em ambos os workspaces
    const TEST_CNPJ = "60746948000112";
    await prisma.opportunityHistory.deleteMany({ where: { opportunity: { company: { cnpj: TEST_CNPJ } } } });
    await prisma.opportunity.deleteMany({ where: { company: { cnpj: TEST_CNPJ } } });
    await prisma.companyHistory.deleteMany({ where: { company: { cnpj: TEST_CNPJ } } });
    await prisma.company.deleteMany({ where: { cnpj: TEST_CNPJ } });

    const batchA = await companiesA.createImportBatch({
      fonte: "pg-test-a",
      correlationId: "corr-pg-a",
      totalRows: 1,
      imported: 1,
      duplicates: 0,
      rejected: 0,
      importedBy: "user:op",
    });

    // Concorrência em PostgreSQL no upsertCompanies para o mesmo CNPJ
    const upsertConcurrent = await Promise.all(
      Array.from({ length: 5 }, () =>
        companiesA.upsertCompanies(batchA.id, [
          {
            company: {
              cnpj: TEST_CNPJ,
              razaoSocial: "GAMMA PG CONCORRENCIA S.A.",
              porte: "MEDIO",
              situacao: "ATIVA",
              uf: "SP",
              fonte: "pg-test-a",
              importadoEm: new Date().toISOString(),
            },
            score: 78,
            reasons: ["Situação ATIVA"],
            gaps: [],
            simulated: false,
          },
        ]),
      ),
    );
    const totalInserted = upsertConcurrent.reduce((acc, r) => acc + r.inserted, 0);
    expect(totalInserted).toBe(1);

    const listA = await companiesA.listCompanies({ q: "GAMMA PG" });
    expect(listA.total).toBe(1);
    const coA = listA.items[0]!;

    // Isolamento: Workspace B não enxerga empresa de Workspace A
    expect(await companiesB.getCompany(coA.id)).toBeUndefined();
    expect((await companiesB.listCompanies({ q: "GAMMA PG" })).total).toBe(0);

    await companiesA.reviewCompany(coA.id, "approved", "user:approver", "Aprovada no Postgres");

    // Concorrência em PostgreSQL no promoteCompany (advisory lock + transação atômica)
    const corrPromote = `corr-pg-opp-${Date.now()}`;
    const promoteConcurrent = await Promise.all(
      Array.from({ length: 8 }, () =>
        oppsA.promoteCompany({
          companyId: coA.id,
          approvedBy: "user:approver",
          justification: "Promoção transacional PostgreSQL",
          correlationId: corrPromote,
        }),
      ),
    );
    expect(promoteConcurrent.filter((r) => r.created).length).toBe(1);
    expect(promoteConcurrent.filter((r) => r.duplicate).length).toBe(7);

    const oppA = promoteConcurrent[0]!.opportunity;

    // Verifica que AuditEvent e EventOutbox foram gravados na mesma transação PostgreSQL
    const txAudits = await prisma.auditEvent.findMany({
      where: { workspaceId: wsA, entityId: oppA.id, action: "opportunity.promoted_tx" },
    });
    expect(txAudits.length).toBe(1);

    const txOutbox = await prisma.eventOutbox.findUnique({
      where: { eventId: `opp_created_${oppA.id}` },
    });
    expect(txOutbox).toBeTruthy();
    expect(txOutbox?.eventType).toBe("opportunity.created.v1");

    // Isolamento: Workspace B não enxerga nem consegue transicionar oportunidade de Workspace A
    expect(await oppsB.getOpportunity(oppA.id)).toBeUndefined();
    await expect(
      oppsB.transitionOpportunity(oppA.id, "researching", "user:evil", { correlationId: "c-evil" }),
    ).rejects.toThrow(/oportunidade não encontrada/);

    // Verifica que costStore também funciona no workspace A
    expect(await costsA.sumRealUnits("2020-01-01T00:00:00.000Z", "2030-01-01T00:00:00.000Z")).toBeGreaterThanOrEqual(0);
  });
});
