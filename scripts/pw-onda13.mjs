import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const OUT_DIR = resolve("docs/onda-13/evidencias");
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

  // 2. Prontidão Comercial (Onda 13 / Fase 02)
  await page.click("nav button:has-text('Prontidão Comercial')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "02-prontidao-comercial-desktop.png"), fullPage: true });
  record("Desktop: 02-prontidao-comercial-desktop.png capturado", true);

  // 3. Ficha Consolidada / Dossiê Integrado (Onda 13 / Fase 05)
  await page.click("nav button:has-text('Ficha Consolidada')");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(OUT_DIR, "03-ficha-consolidada-desktop.png"), fullPage: true });
  record("Desktop: 03-ficha-consolidada-desktop.png capturado", true);

  // 4. Métricas do Piloto (Onda 13 / Fase 06)
  await page.click("nav button:has-text('Métricas Piloto')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "04-metricas-piloto-desktop.png"), fullPage: true });
  record("Desktop: 04-metricas-piloto-desktop.png capturado", true);

  // 5. Pipeline Comercial
  await page.click("nav button:has-text('Pipeline')");
  await page.waitForTimeout(1000);
  const oppCard = page.locator("[data-testid^='opp-card-']").first();
  if ((await oppCard.count()) > 0) {
    await oppCard.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "05-pipeline-comercial-desktop.png"), fullPage: true });
  record("Desktop: 05-pipeline-comercial-desktop.png capturado", true);

  // 6. Central Scout
  await page.click("nav button:has-text('Scout')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "06-scout-desktop.png"), fullPage: true });
  record("Desktop: 06-scout-desktop.png capturado", true);

  // 7. Central de Aprovações
  await page.click("nav button:has-text('Aprovações')");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: resolve(OUT_DIR, "07-aprovacoes-desktop.png"), fullPage: true });
  record("Desktop: 07-aprovacoes-desktop.png capturado", true);

  // 8. Escritório 3D com os 6 Agentes
  await page.click("nav button:has-text('Escritório')");
  await page.waitForTimeout(2500);
  const meridianBtn = page.locator("[data-testid='office-agent-btn-meridian']").first();
  if ((await meridianBtn.count()) > 0) {
    await meridianBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: resolve(OUT_DIR, "08-escritorio-3d-desktop.png"), fullPage: true });
  record("Desktop: 08-escritorio-3d-desktop.png capturado", true);

  await desktopCtx.close();

  // =========================================================================
  // 2. MOBILE 390x844 (iPhone 14 / viewport mobile)
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

  // 2. Mobile Prontidão Comercial
  await mPage.click("nav button:has-text('Prontidão Comercial')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "02-prontidao-comercial-mobile.png"), fullPage: true });
  record("Mobile: 02-prontidao-comercial-mobile.png capturado", true);

  // 3. Mobile Ficha Consolidada
  await mPage.click("nav button:has-text('Ficha Consolidada')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "03-ficha-consolidada-mobile.png"), fullPage: true });
  record("Mobile: 03-ficha-consolidada-mobile.png capturado", true);

  // 4. Mobile Métricas do Piloto
  await mPage.click("nav button:has-text('Métricas Piloto')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "04-metricas-piloto-mobile.png"), fullPage: true });
  record("Mobile: 04-metricas-piloto-mobile.png capturado", true);

  // 5. Mobile Pipeline
  await mPage.click("nav button:has-text('Pipeline')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "05-pipeline-comercial-mobile.png"), fullPage: true });
  record("Mobile: 05-pipeline-comercial-mobile.png capturado", true);

  // 6. Mobile Scout
  await mPage.click("nav button:has-text('Scout')");
  await mPage.waitForTimeout(800);
  await mPage.screenshot({ path: resolve(OUT_DIR, "06-scout-mobile.png"), fullPage: true });
  record("Mobile: 06-scout-mobile.png capturado", true);

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
  results.push({ name: "Execução Playwright", passed: false, detail: err.message, line: `FAIL | ${err.message}` });
} finally {
  await browser.close();

  const report = [
    `# Relatório de Execução Playwright — Onda 13`,
    `Data: ${new Date().toISOString()}`,
    `Total de screenshots: ${results.filter((r) => r.passed).length} / 16`,
    `Sucesso: ${results.filter((r) => r.passed).length}`,
    `Falhas: ${results.filter((r) => !r.passed).length}`,
    `Erros de página: ${pageErrors.length}`,
    "",
    "## Inventário de Evidências Capturadas",
    ...results.map((r) => `- ${r.line}`),
    ...(pageErrors.length > 0
      ? ["", "## Erros de página detectados", ...pageErrors.map((e) => `- ${e}`)]
      : ["", "Nenhum erro de console ou runtime detectado."]),
  ].join("\n");

  writeFileSync(resolve(OUT_DIR, "playwright-report.md"), report, "utf-8");
  console.log("\n" + report);
}
