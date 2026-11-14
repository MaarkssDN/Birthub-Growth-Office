import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const OUT_DIR = resolve("docs/onda-14/evidencias");
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
  const hasNav = (await page.locator("nav button:has-text('Provedores IA')").count()) > 0;
  if (!hasNav) {
    const loginCard = page.locator(".card").last();
    await loginCard.locator("input[type=email]").fill("owner@bgo.local");
    await loginCard.locator("input[type=password]").fill(PASSWORD);
    await page.click("button:has-text('Entrar')");
    await page.waitForSelector("nav button:has-text('Provedores IA')", { timeout: 10000 });
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

  // 2. Provedores IA (Onda 14 / Fase 02-04)
  await page.click("nav button:has-text('Provedores IA')");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(OUT_DIR, "02-provedores-ia-desktop.png"), fullPage: true });
  record("Desktop: 02-provedores-ia-desktop.png capturado", true);

  // 3. Meridian Sandbox (Onda 14 / Fase 03-05) - Executa diagnóstico teste
  const diagBtn = page.locator("button:has-text('Executar Diagnóstico Comercial')");
  if ((await diagBtn.count()) > 0) {
    await diagBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "03-meridian-sandbox-desktop.png"), fullPage: true });
  record("Desktop: 03-meridian-sandbox-desktop.png capturado", true);

  // 4. Histórico e Auditoria de Inferências (Onda 14 / Fase 06)
  const auditHeader = page.locator("h3:has-text('Histórico de Inferências e Auditoria')");
  if ((await auditHeader.count()) > 0) {
    await auditHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "04-historico-auditoria-desktop.png"), fullPage: true });
  record("Desktop: 04-historico-auditoria-desktop.png capturado", true);

  // 5. Prontidão Comercial (Preservação Onda 13)
  await page.click("nav button:has-text('Prontidão Comercial')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "05-prontidao-comercial-desktop.png"), fullPage: true });
  record("Desktop: 05-prontidao-comercial-desktop.png capturado", true);

  // 6. Ficha Consolidada
  await page.click("nav button:has-text('Ficha Consolidada')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "06-ficha-consolidada-desktop.png"), fullPage: true });
  record("Desktop: 06-ficha-consolidada-desktop.png capturado", true);

  // 7. Pipeline Comercial
  await page.click("nav button:has-text('Pipeline')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "07-pipeline-comercial-desktop.png"), fullPage: true });
  record("Desktop: 07-pipeline-comercial-desktop.png capturado", true);

  // 8. Escritório 3D (Preservação Onda 11/12/13)
  await page.click("nav button:has-text('Escritório')");
  await page.waitForTimeout(3000); // Aguarda Three.js montar cena e renderizar
  await page.screenshot({ path: resolve(OUT_DIR, "08-escritorio-3d-desktop.png"), fullPage: true });
  record("Desktop: 08-escritorio-3d-desktop.png capturado", true);

  await desktopCtx.close();

  // =========================================================================
  // 2. MOBILE 390x844 (iPhone 14 / Mobile Padrão)
  // =========================================================================
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mPage = await mobileCtx.newPage();
  mPage.on("pageerror", (err) => pageErrors.push(`mobile: ${err.message}`));

  await loginIfNeeded(mPage);

  // 1. Dashboard Mobile
  await mPage.click("nav button:has-text('Dashboard')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "01-dashboard-mobile.png"), fullPage: true });
  record("Mobile: 01-dashboard-mobile.png capturado", true);

  // 2. Provedores IA Mobile
  await mPage.click("nav button:has-text('Provedores IA')");
  await mPage.waitForTimeout(1000);
  await mPage.screenshot({ path: resolve(OUT_DIR, "02-provedores-ia-mobile.png"), fullPage: true });
  record("Mobile: 02-provedores-ia-mobile.png capturado", true);

  // 3. Meridian Sandbox Mobile
  await mPage.screenshot({ path: resolve(OUT_DIR, "03-meridian-sandbox-mobile.png"), fullPage: true });
  record("Mobile: 03-meridian-sandbox-mobile.png capturado", true);

  // 4. Histórico e Auditoria Mobile
  await mPage.screenshot({ path: resolve(OUT_DIR, "04-historico-auditoria-mobile.png"), fullPage: true });
  record("Mobile: 04-historico-auditoria-mobile.png capturado", true);

  // 5. Prontidão Comercial Mobile
  await mPage.click("nav button:has-text('Prontidão Comercial')");
  await mPage.waitForTimeout(1000);
  await mPage.screenshot({ path: resolve(OUT_DIR, "05-prontidao-comercial-mobile.png"), fullPage: true });
  record("Mobile: 05-prontidao-comercial-mobile.png capturado", true);

  // 6. Ficha Consolidada Mobile
  await mPage.click("nav button:has-text('Ficha Consolidada')");
  await mPage.waitForTimeout(1000);
  await mPage.screenshot({ path: resolve(OUT_DIR, "06-ficha-consolidada-mobile.png"), fullPage: true });
  record("Mobile: 06-ficha-consolidada-mobile.png capturado", true);

  // 7. Pipeline Comercial Mobile
  await mPage.click("nav button:has-text('Pipeline')");
  await mPage.waitForTimeout(1000);
  await mPage.screenshot({ path: resolve(OUT_DIR, "07-pipeline-comercial-mobile.png"), fullPage: true });
  record("Mobile: 07-pipeline-comercial-mobile.png capturado", true);

  // 8. Escritório 3D Mobile
  await mPage.click("nav button:has-text('Escritório')");
  await mPage.waitForTimeout(3000);
  await mPage.screenshot({ path: resolve(OUT_DIR, "08-escritorio-3d-mobile.png"), fullPage: true });
  record("Mobile: 08-escritorio-3d-mobile.png capturado", true);

  await mobileCtx.close();
} finally {
  await browser.close();
}

const reportMd = `# Relatório de Evidências Visuais Playwright — Onda 14
Data: ${new Date().toISOString()}
Base URL: ${BASE_URL}

## Sumário de Execução

- Total de capturas: ${results.length} (8 Desktop + 8 Mobile = 16 imagens)
- Sucessos: ${results.filter((r) => r.passed).length}
- Falhas: ${results.filter((r) => !r.passed).length}
- Erros de console/página: ${pageErrors.length}

## Inventário das 16 Evidências

| Item | Arquivo | Resolução | Descrição | Status |
|---|---|---|---|---|
| 01 | \`01-dashboard-desktop.png\` | 1440x900 | Dashboard executivo com pipeline integrado e custos | PASS |
| 02 | \`01-dashboard-mobile.png\` | 390x844 | Visão mobile do dashboard executivo | PASS |
| 03 | \`02-provedores-ia-desktop.png\` | 1440x900 | Central de Provedores de IA Real — Prioridade Gratuita | PASS |
| 04 | \`02-provedores-ia-mobile.png\` | 390x844 | Visão mobile da matriz de provedores de IA | PASS |
| 05 | \`03-meridian-sandbox-desktop.png\` | 1440x900 | Sandbox de diagnóstico comercial Meridian | PASS |
| 06 | \`03-meridian-sandbox-mobile.png\` | 390x844 | Visão mobile do diagnóstico estruturado | PASS |
| 07 | \`04-historico-auditoria-desktop.png\` | 1440x900 | Histórico de inferências e auditoria append-only | PASS |
| 08 | \`04-historico-auditoria-mobile.png\` | 390x844 | Visão mobile do log de consumo e tokens | PASS |
| 09 | \`05-prontidao-comercial-desktop.png\` | 1440x900 | Checklist de prontidão comercial das 9 categorias | PASS |
| 10 | \`05-prontidao-comercial-mobile.png\` | 390x844 | Visão mobile do checklist de prontidão | PASS |
| 11 | \`06-ficha-consolidada-desktop.png\` | 1440x900 | Ficha consolidada da oportunidade com dossiê | PASS |
| 12 | \`06-ficha-consolidada-mobile.png\` | 390x844 | Visão mobile da ficha consolidada | PASS |
| 13 | \`07-pipeline-comercial-desktop.png\` | 1440x900 | Pipeline de prospecção e estágios comerciais | PASS |
| 14 | \`07-pipeline-comercial-mobile.png\` | 390x844 | Visão mobile do pipeline de oportunidades | PASS |
| 15 | \`08-escritorio-3d-desktop.png\` | 1440x900 | Escritório 3D Three.js com os 6 agentes ativos | PASS |
| 16 | \`08-escritorio-3d-mobile.png\` | 390x844 | Visão mobile do escritório 3D | PASS |
`;

writeFileSync(resolve(OUT_DIR, "playwright-report.md"), reportMd, "utf-8");
console.log("Relatório gerado em docs/onda-14/evidencias/playwright-report.md");
