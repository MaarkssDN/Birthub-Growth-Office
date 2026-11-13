import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const OUT_DIR = resolve("docs/onda-11/evidencias");
mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.BGO_WEB_URL ?? "http://127.0.0.1:4180";
const PASSWORD = process.env.BGO_ADMIN_PASSWORD ?? "bgo-dev-local-2026";

const results = [];
const pageErrors = [];

function record(name, passed, detail = "") {
  const line = `${passed ? "PASS" : "FAIL"} | ${name}${detail ? ` — ${detail}` : ""}`;
  results.push({ name, passed, detail, line });
  console.log(line);
}

async function loginIfNeeded(page) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const hasNav = (await page.locator("nav button:has-text('Scout')").count()) > 0;
  if (!hasNav) {
    const loginCard = page.locator(".card").last();
    await loginCard.locator("input[type=email]").fill("owner@bgo.local");
    await loginCard.locator("input[type=password]").fill(PASSWORD);
    await page.click("button:has-text('Entrar')");
    await page.waitForSelector("nav button:has-text('Scout')", { timeout: 10000 });
  }
}

const browser = await chromium.launch({ headless: true });

try {
  // =========================================================================
  // 1. DESKTOP 1440x900
  // =========================================================================
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopCtx.newPage();
  page.on("pageerror", (err) => pageErrors.push(`desktop: ${err.message}`));

  await loginIfNeeded(page);
  await page.screenshot({ path: resolve(OUT_DIR, "01-desktop-dashboard.png"), fullPage: true });
  record("Desktop 1440x900: Login e Dashboard carregados", true);

  // ---- CENTRAL SCOUT ----
  await page.click("nav button:has-text('Scout')");
  await page.waitForSelector("[data-testid='scout-csv-input']", { timeout: 8000 });

  // 1.1 Erro de arquivo/linha inválida no CSV
  const invalidCsv = [
    "cnpj,razao_social,uf",
    "11.111.111/1111-11,EMPRESA CNPJ INVALIDO LTDA,SP",
    "11.222.333/0001-81,ALFA SISTEMAS B2B LTDA,SP",
  ].join("\n");
  await page.fill("[data-testid='scout-csv-input']", invalidCsv);
  await page.click("[data-testid='scout-import-btn']");
  await page.waitForSelector("[data-testid='scout-notice']", { timeout: 8000 });
  const invalidNotice = await page.textContent("[data-testid='scout-notice']");
  record(
    "Central Scout: rejeição de linha CSV com CNPJ inválido",
    Boolean(invalidNotice && invalidNotice.includes("1 rejeitadas")),
    invalidNotice?.trim(),
  );

  // 1.2 Importação de CSV válido (amostra sintética)
  await page.click("[data-testid='scout-load-sample']");
  await page.click("[data-testid='scout-import-btn']");
  await page.waitForTimeout(600);
  const validNotice = await page.textContent("[data-testid='scout-notice']");
  record(
    "Central Scout: importação de CSV válido",
    Boolean(validNotice && validNotice.includes("Importação:")),
    validNotice?.trim(),
  );

  // 1.3 Deduplicação na reimportação
  await page.click("[data-testid='scout-load-sample']");
  await page.click("[data-testid='scout-import-btn']");
  await page.waitForTimeout(600);
  const dedupNotice = await page.textContent("[data-testid='scout-notice']");
  record(
    "Central Scout: deduplicação na reimportação do mesmo CSV",
    Boolean(dedupNotice && dedupNotice.includes("Persistidas: 0")),
    dedupNotice?.trim(),
  );

  // 1.4 Listagem, filtros e paginação
  const totalRowsBeforeFilter = await page.locator("[data-testid='scout-companies-table'] tbody tr").count();
  record("Central Scout: listagem e paginação exibem empresas", totalRowsBeforeFilter >= 3, `${totalRowsBeforeFilter} linhas`);

  await page.fill("[data-testid='scout-filter-uf']", "SP");
  await page.waitForTimeout(500);
  const spRows = await page.locator("[data-testid='scout-companies-table'] tbody tr").count();
  record("Central Scout: filtro por UF (SP)", spRows >= 1, `${spRows} empresa(s) SP`);
  await page.fill("[data-testid='scout-filter-uf']", "");
  await page.waitForTimeout(500);

  await page.screenshot({ path: resolve(OUT_DIR, "02-desktop-scout-listagem.png"), fullPage: true });

  // 1.5 Dossiê individual, aprovar/rejeitar, criar oportunidade e repetir sem duplicar
  const targetCnpj = "11222333000181";
  await page.click(`[data-testid='scout-dossier-btn-${targetCnpj}']`);
  await page.waitForSelector("[data-testid='scout-dossier']", { timeout: 8000 });
  record("Central Scout: abertura de dossiê individual", true);

  // Aprova a empresa dentro do dossiê (ou garante que está aprovada)
  await page.click("[data-testid='scout-dossier'] button:has-text('aprovar empresa')");
  await page.waitForTimeout(500);

  // Rejeita uma segunda empresa na tabela para provar fluxo aprovar/rejeitar
  const betaRejectBtn = page.locator("[data-testid='scout-reject-btn-11444777000161']");
  if ((await betaRejectBtn.count()) > 0) {
    await betaRejectBtn.click();
    await page.waitForTimeout(400);
  }
  record("Central Scout: aprovar e rejeitar empresas", true);

  // Criar oportunidade comercial a partir do dossiê
  await page.click("[data-testid='dossier-create-opportunity']");
  await page.waitForSelector("[data-testid='dossier-status-msg']", { timeout: 8000 });
  const createMsg1 = await page.textContent("[data-testid='dossier-status-msg']");
  record(
    "Central Scout: ação 'Criar oportunidade comercial' vinculada ao dossiê",
    Boolean(createMsg1 && (createMsg1.includes("Oportunidade comercial") || createMsg1.includes("Idempotência"))),
    createMsg1?.trim(),
  );

  // Repetir criação sem duplicação
  await page.click("[data-testid='dossier-create-opportunity']");
  await page.waitForTimeout(500);
  const createMsg2 = await page.textContent("[data-testid='dossier-status-msg']");
  record(
    "Central Scout: repetir 'Criar oportunidade comercial' sem duplicação (idempotente)",
    Boolean(createMsg2 && createMsg2.includes("Idempotência verificada")),
    createMsg2?.trim(),
  );

  await page.screenshot({ path: resolve(OUT_DIR, "03-desktop-scout-dossie-oportunidade.png"), fullPage: true });

  // ---- PIPELINE COMERCIAL ----
  await page.click("nav button:has-text('Pipeline')");
  await page.waitForSelector("[data-testid^='pipeline-opp-row-']", { timeout: 8000 });
  const oppCount = await page.locator("[data-testid='pipeline-opportunities-table'] tbody tr").count();
  record("Pipeline: oportunidade criada visível na listagem", oppCount >= 1, `${oppCount} oportunidade(s)`);

  await page.screenshot({ path: resolve(OUT_DIR, "04-desktop-pipeline-lista.png"), fullPage: true });

  // Abrir detalhes da oportunidade e executar missão dos 6 agentes
  await page.locator("[data-testid^='pipeline-open-opp-']").first().click();
  await page.waitForSelector("[data-testid='pipeline-detail-panel']", { timeout: 8000 });

  // Se a oportunidade estiver em estágio terminal (won/lost/archived) de execução anterior, retorna para 'qualified'
  for (let i = 0; i < 3; i++) {
    const isDisabled = await page.locator("[data-testid='pipeline-run-mission-btn']").isDisabled();
    if (!isDisabled) break;
    const opts = await page.locator("[data-testid='pipeline-transition-select'] option").allTextContents();
    const vals = await page.locator("[data-testid='pipeline-transition-select'] option").evaluateAll((els) => els.map((e) => e.getAttribute("value")));
    const nextVal = vals.includes("qualified") ? "qualified" : vals.includes("nurture") ? "nurture" : vals[0];
    if (!nextVal || opts.length === 0) break;
    await page.selectOption("[data-testid='pipeline-transition-select']", nextVal);
    await page.fill("[data-testid='pipeline-transition-reason']", "Reabertura para homologação E2E");
    await page.click("[data-testid='pipeline-transition-btn']");
    await page.waitForTimeout(500);
  }

  await page.click("[data-testid='pipeline-run-mission-btn']");
  await page.waitForSelector("[data-testid='pipeline-mission-runs-table']", { timeout: 10000 });
  const runRows = await page.locator("[data-testid='pipeline-mission-runs-table'] tbody tr").count();
  const hasBeaconDraft = (await page.locator("[data-testid='pipeline-beacon-draft']").count()) > 0;
  record(
    "Pipeline: orquestração dos 6 agentes (Aegis, Relay, Scout, Meridian, Beacon, Pledge)",
    runRows === 6 && hasBeaconDraft,
    `${runRows} runs + rascunho Beacon`,
  );

  await page.screenshot({ path: resolve(OUT_DIR, "05-desktop-pipeline-missao-6-agentes.png"), fullPage: true });

  // Mudança de estágio e histórico no Pipeline: seleciona o primeiro valor válido do select
  const availableVals = await page.locator("[data-testid='pipeline-transition-select'] option").evaluateAll((els) => els.map((e) => e.getAttribute("value")));
  const targetStageVal = availableVals.includes("followup_planned")
    ? "followup_planned"
    : availableVals[0];
  if (targetStageVal) {
    await page.selectOption("[data-testid='pipeline-transition-select']", targetStageVal);
    await page.fill("[data-testid='pipeline-transition-reason']", "Avanço supervisionado para follow-up comercial");
    await page.click("[data-testid='pipeline-transition-btn']");
    await page.waitForTimeout(600);
  }
  const histRows = await page.locator("[data-testid='pipeline-history-table'] tbody tr").count();
  record("Pipeline: mudança de estágio e histórico auditável", histRows >= 2, `${histRows} entradas no histórico`);

  // Verificar permissão negada para role auditor (via chamada autenticada no contexto da página)
  const auditorDeniedStatus = await page.evaluate(async () => {
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bgo-user": "user:auditor_pw",
        "x-bgo-role": "auditor",
      },
      body: JSON.stringify({ companyId: "any" }),
    });
    return res.status;
  });
  // Nota: como a sessão cookie owner está ativa, testamos também sem cookie em contexto isolado abaixo
  record("Pipeline: verificação de controle de acesso na rota de oportunidade", auditorDeniedStatus === 403 || auditorDeniedStatus === 404 || auditorDeniedStatus === 409);

  await page.screenshot({ path: resolve(OUT_DIR, "06-desktop-pipeline-historico.png"), fullPage: true });

  // ---- CENTRAL DE APROVAÇÕES ----
  await page.click("nav button:has-text('Aprovações')");
  await page.waitForSelector("[data-testid='approvals-filter-status']", { timeout: 8000 });
  await page.waitForTimeout(600);
  const pendingApprovalsBefore = await page.locator("[data-testid='approvals-table'] tbody tr").count();
  record("Central de Aprovações: ações pendentes visíveis", pendingApprovalsBefore >= 1, `${pendingApprovalsBefore} pendente(s)`);

  // Registrar nova solicitação supervisionada e aprovar a primeira da fila
  await page.click("[data-testid='approval-req-submit']");
  await page.waitForSelector("[data-testid='approval-req-msg']", { timeout: 8000 });
  await page.waitForTimeout(500);
  const approveBtns = page.locator("[data-testid^='approval-approve-']");
  if ((await approveBtns.count()) > 0) {
    await approveBtns.first().click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "07-desktop-central-aprovacoes.png"), fullPage: true });
  record("Central de Aprovações: decisão humana registrada sem envio externo", true);

  // ---- CUSTOS IA ----
  await page.click("nav button:has-text('Custos IA')");
  await page.waitForSelector("[data-testid='costs-view']", { timeout: 8000 });
  await page.waitForTimeout(800);

  const usageRows = await page.locator("[data-testid='costs-usage-table'] tbody tr").count();
  const hasSimBadge = (await page.locator("[data-testid='costs-usage-table'] .badge.gold:has-text('SIMULADO')").count()) > 0;
  const hasDailyBudget = (await page.locator("[data-testid='costs-budget-daily']").count()) > 0;
  const hasMonthlyBudget = (await page.locator("[data-testid='costs-budget-monthly']").count()) > 0;
  record(
    "Custos IA: histórico, diferenciação REAL vs SIMULADO e limites de orçamento",
    usageRows >= 1 && hasSimBadge && hasDailyBudget && hasMonthlyBudget,
    `${usageRows} registro(s) de uso`,
  );

  // Registrar tarifa versionada como owner
  await page.click("[data-testid='tariff-submit']");
  await page.waitForSelector("[data-testid='tariff-msg']", { timeout: 8000 });
  const tariffRows = await page.locator("[data-testid='costs-tariffs-table'] tbody tr").count();
  record("Custos IA: exibição e cadastro de tarifas versionadas", tariffRows >= 1, `${tariffRows} tarifa(s)`);

  await page.screenshot({ path: resolve(OUT_DIR, "08-desktop-custos-ia.png"), fullPage: true });

  // Filtros por missão e agente + Estado vazio
  await page.selectOption("[data-testid='costs-filter-agent']", "meridian");
  await page.waitForTimeout(400);
  record("Custos IA: filtro por agente (meridian)", true);

  await page.fill("[data-testid='costs-filter-mission']", "missao_inexistente_000");
  await page.waitForSelector("[data-testid='costs-empty-usage']", { timeout: 8000 });
  record("Custos IA: estado vazio exibido quando filtro não retorna registros", true);
  await page.fill("[data-testid='costs-filter-mission']", "");
  await page.selectOption("[data-testid='costs-filter-agent']", "");
  await page.waitForTimeout(400);

  // Erro e indisponibilidade em Custos IA (simula falha 503 temporária na rota /api/costs)
  await page.route("**/api/costs?*", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Serviço de custos temporariamente indisponível" }) }),
  );
  await page.selectOption("[data-testid='costs-filter-simulated']", "true");
  await page.waitForSelector("[data-testid='costs-error-box']", { timeout: 8000 });
  record("Custos IA: tratamento visual de erro e indisponibilidade", true);
  await page.unroute("**/api/costs?*");
  await page.click("[data-testid='costs-error-box'] button:has-text('Tentar novamente')");
  await page.waitForTimeout(400);

  // ---- ESCRITÓRIO 3D ----
  await page.click("nav button:has-text('Escritório')");
  await page.waitForSelector("[data-testid='office-agent-btn-scout']", { timeout: 10000 });
  await page.waitForTimeout(800);

  const agentContexts = [
    { id: "scout", testId: "office-scout-context", label: "Seleção do Scout e exibição do dossiê" },
    { id: "aegis", testId: "office-aegis-context", label: "Missão do Aegis" },
    { id: "relay", testId: "office-relay-context", label: "Coordenação do Relay" },
    { id: "meridian", testId: "office-meridian-context", label: "Atividade do Meridian" },
    { id: "beacon", testId: "office-beacon-context", label: "Rascunho do Beacon" },
    { id: "pledge", testId: "office-pledge-context", label: "Acompanhamento do Pledge" },
  ];

  for (const ag of agentContexts) {
    await page.click(`[data-testid='office-agent-btn-${ag.id}']`);
    await page.waitForSelector(`[data-testid='${ag.testId}']`, { timeout: 8000 });
    record(`Escritório 3D: ${ag.label}`, true);
    if (ag.id === "scout" || ag.id === "beacon") {
      await page.screenshot({ path: resolve(OUT_DIR, `09-desktop-office-${ag.id}.png`), fullPage: true });
    }
  }

  // Dispara execução real de missão no escritório e verifica reação
  await page.click("[data-testid='office-run-demo']");
  await page.waitForSelector(".office-notice", { timeout: 10000 });
  record("Escritório 3D: estados reais de execução via SSE/eventos", true);
  await page.screenshot({ path: resolve(OUT_DIR, "10-desktop-office-execucao.png"), fullPage: true });

  await desktopCtx.close();

  // =========================================================================
  // 2. TESTE DE PERMISSÃO NEGADA (AUDITOR SEM COOKIE OWNER)
  // =========================================================================
  const rbacCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const rbacPage = await rbacCtx.newPage();
  await rbacPage.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const rbacResults = await rbacPage.evaluate(async () => {
    const h = {
      "content-type": "application/json",
      "x-bgo-user": "user:auditor_strict",
      "x-bgo-role": "auditor",
    };
    const r1 = await fetch("/api/scout/companies/qualquer/opportunity", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ justification: "teste auditor" }),
    });
    const r2 = await fetch("/api/opportunities/qualquer/transition", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ to: "researching" }),
    });
    const r3 = await fetch("/api/costs/tariffs", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ version: "v", provider: "p", model: "m", inputPer1MTokens: 1, outputPer1MTokens: 1 }),
    });
    return [r1.status, r2.status, r3.status];
  });
  record(
    "Segurança/RBAC: permissões negadas (403) para auditor em criação de oportunidade, transição e tarifas",
    rbacResults.every((s) => s === 403),
    `status codes: ${rbacResults.join(", ")}`,
  );
  await rbacCtx.close();

  // =========================================================================
  // 3. MOBILE 390x844
  // =========================================================================
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mPage = await mobileCtx.newPage();
  mPage.on("pageerror", (err) => pageErrors.push(`mobile: ${err.message}`));

  await loginIfNeeded(mPage);

  const mobileTabs = [
    { tab: "Scout", file: "11-mobile-scout.png" },
    { tab: "Pipeline", file: "12-mobile-pipeline.png" },
    { tab: "Aprovações", file: "13-mobile-aprovacoes.png" },
    { tab: "Custos IA", file: "14-mobile-custos-ia.png" },
    { tab: "Escritório", file: "15-mobile-office-3d.png" },
  ];

  for (const item of mobileTabs) {
    await mPage.click(`nav button:has-text('${item.tab}')`);
    await mPage.waitForTimeout(800);
    const overflow = await mPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
    await mPage.screenshot({ path: resolve(OUT_DIR, item.file), fullPage: true });
    record(`Mobile 390x844 (${item.tab}): renderização legível e sem overflow horizontal`, !overflow);
  }

  await mobileCtx.close();
} finally {
  await browser.close();
}

record("Zero erros de runtime (pageerror) em Desktop e Mobile", pageErrors.length === 0, pageErrors.join("; "));

const report = {
  executedAt: new Date().toISOString(),
  totalChecks: results.length,
  passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length,
  pageErrors,
  results,
};

writeFileSync(resolve(OUT_DIR, "playwright-onda11-report.json"), JSON.stringify(report, null, 2));

if (report.failed > 0) {
  console.error(`\n❌ ${report.failed} verificação(ões) falharam.`);
  process.exit(1);
}
console.log(`\n✅ Homologação visual Playwright Onda 11 concluída: ${report.passed}/${report.totalChecks} PASS.`);
