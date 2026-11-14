import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const OUT_DIR = resolve("docs/onda-12/evidencias");
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
  await page.waitForTimeout(1000);
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

  // 1. Dashboard
  await page.click("nav button:has-text('Dashboard')");
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(OUT_DIR, "01-dashboard-desktop.png"), fullPage: true });
  record("Desktop: 01-dashboard-desktop.png capturado", true);

  // 2. Scout
  await page.click("nav button:has-text('Scout')");
  await page.waitForSelector("[data-testid='scout-csv-input']", { timeout: 8000 });

  // Importa CSV sintético
  const validCsv = [
    "cnpj,razao_social,nome_fantasia,cnae,porte,situacao,municipio,uf",
    "11.222.333/0001-81,ALFA SISTEMAS B2B LTDA,Alfa Cloud,6201-5/01,MEDIO,ATIVA,Sao Paulo,SP",
    "11.444.777/0001-61,BETA ANALYTICS S.A.,Beta Data,6202-3/00,EPP,ATIVA,Curitiba,PR",
  ].join("\n");
  await page.fill("[data-testid='scout-csv-input']", validCsv);
  await page.click("[data-testid='scout-import-btn']");
  await page.waitForTimeout(1000);

  // Aprova a primeira empresa se houver botão de aprovação
  const approveBtn = page.locator("button:has-text('aprovar')").first();
  if ((await approveBtn.count()) > 0) {
    await approveBtn.click();
    await page.waitForTimeout(500);
  }

  // Tenta criar oportunidade se o botão estiver visível
  const createOppBtn = page.locator("button:has-text('Criar oportunidade comercial')").first();
  if ((await createOppBtn.count()) > 0) {
    await createOppBtn.click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({ path: resolve(OUT_DIR, "02-scout-desktop.png"), fullPage: true });
  record("Desktop: 02-scout-desktop.png capturado", true);

  // 3. Pipeline
  await page.click("nav button:has-text('Pipeline')");
  await page.waitForTimeout(1000);
  // Se houver oportunidade, clica nela para abrir o painel de detalhes
  const oppCard = page.locator("[data-testid^='opp-card-']").first();
  if ((await oppCard.count()) > 0) {
    await oppCard.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "03-pipeline-desktop.png"), fullPage: true });
  record("Desktop: 03-pipeline-desktop.png capturado", true);

  // 4. ICP Dinâmico (Fase 02)
  await page.click("nav button:has-text('ICP Dinâmico')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "04-icp-dinamico-desktop.png"), fullPage: true });
  record("Desktop: 04-icp-dinamico-desktop.png capturado", true);

  // 5. Central de Comunicação Supervisionada & Sandbox (Fase 05)
  await page.click("nav button:has-text('Comunicação')");
  await page.waitForTimeout(1000);
  // Executa um disparo simulado no sandbox via formulário de teste
  const recipientInput = page.locator("input[placeholder*='contato@empresa']").first();
  if ((await recipientInput.count()) > 0) {
    await recipientInput.fill("comercial.teste@cliente-sintetico.local");
  }
  const testSandboxBtn = page.locator("button:has-text('Executar Disparo de Teste (Sandbox)')").first();
  if ((await testSandboxBtn.count()) > 0) {
    await testSandboxBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "05-comunicacao-sandbox-desktop.png"), fullPage: true });
  record("Desktop: 05-comunicacao-sandbox-desktop.png capturado", true);

  // 6. Oferta Comercial (Fase 06)
  await page.click("nav button:has-text('Oferta Comercial')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "06-oferta-comercial-desktop.png"), fullPage: true });
  record("Desktop: 06-oferta-comercial-desktop.png capturado", true);

  // 7. Central de Aprovações
  await page.click("nav button:has-text('Aprovações')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "07-aprovacoes-desktop.png"), fullPage: true });
  record("Desktop: 07-aprovacoes-desktop.png capturado", true);

  // 8. Escritório 3D com Contexto Comercial dos 6 Agentes
  await page.click("nav button:has-text('Escritório')");
  await page.waitForTimeout(2000);
  // Seleciona Meridian para exibir o painel de qualificação SDR e fatos/inferências
  const meridianBtn = page.locator("[data-testid='office-agent-btn-meridian']").first();
  if ((await meridianBtn.count()) > 0) {
    await meridianBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "08-escritorio-3d-desktop.png"), fullPage: true });
  record("Desktop: 08-escritorio-3d-desktop.png capturado", true);

  await desktopCtx.close();

  // =========================================================================
  // 2. MOBILE 390x844 (iPhone 14 / viewport moderno)
  // =========================================================================
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mPage = await mobileCtx.newPage();
  mPage.on("pageerror", (err) => pageErrors.push(`mobile: ${err.message}`));

  await loginIfNeeded(mPage);

  // 1. Mobile Dashboard
  await mPage.click("nav button:has-text('Dashboard')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "01-dashboard-mobile.png"), fullPage: true });
  record("Mobile: 01-dashboard-mobile.png capturado", true);

  // 2. Mobile Scout
  await mPage.click("nav button:has-text('Scout')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "02-scout-mobile.png"), fullPage: true });
  record("Mobile: 02-scout-mobile.png capturado", true);

  // 3. Mobile Pipeline
  await mPage.click("nav button:has-text('Pipeline')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "03-pipeline-mobile.png"), fullPage: true });
  record("Mobile: 03-pipeline-mobile.png capturado", true);

  // 4. Mobile ICP Dinâmico
  await mPage.click("nav button:has-text('ICP Dinâmico')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "04-icp-dinamico-mobile.png"), fullPage: true });
  record("Mobile: 04-icp-dinamico-mobile.png capturado", true);

  // 5. Mobile Comunicação Sandbox
  await mPage.click("nav button:has-text('Comunicação')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "05-comunicacao-sandbox-mobile.png"), fullPage: true });
  record("Mobile: 05-comunicacao-sandbox-mobile.png capturado", true);

  // 6. Mobile Oferta Comercial
  await mPage.click("nav button:has-text('Oferta Comercial')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "06-oferta-comercial-mobile.png"), fullPage: true });
  record("Mobile: 06-oferta-comercial-mobile.png capturado", true);

  // 7. Mobile Central de Aprovações
  await mPage.click("nav button:has-text('Aprovações')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "07-aprovacoes-mobile.png"), fullPage: true });
  record("Mobile: 07-aprovacoes-mobile.png capturado", true);

  // 8. Mobile Escritório 3D
  await mPage.click("nav button:has-text('Escritório')");
  await mPage.waitForTimeout(2000);
  await mPage.screenshot({ path: resolve(OUT_DIR, "08-escritorio-3d-mobile.png"), fullPage: true });
  record("Mobile: 08-escritorio-3d-mobile.png capturado", true);

  await mobileCtx.close();

} catch (err) {
  console.error("Erro fatal no Playwright:", err);
  record("Execução Playwright", false, err.message);
} finally {
  await browser.close();

  const report = [
    `# Relatório de Execução Playwright — Onda 12`,
    `Data: ${new Date().toISOString()}`,
    `Total de testes: ${results.length}`,
    `Sucesso: ${results.filter((r) => r.passed).length}`,
    `Falhas: ${results.filter((r) => !r.passed).length}`,
    `Erros de página: ${pageErrors.length}`,
    "",
    "## Resultados detalhados",
    ...results.map((r) => `- ${r.line}`),
    ...(pageErrors.length > 0
      ? ["", "## Erros de página detectados", ...pageErrors.map((e) => `- ${e}`)]
      : ["", "Nenhum erro de console ou runtime detectado."]),
  ].join("\n");

  writeFileSync(resolve(OUT_DIR, "playwright-report.md"), report, "utf-8");
  console.log("\n" + report);
}
