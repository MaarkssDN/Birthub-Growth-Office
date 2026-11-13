import { chromium } from "playwright-core";
const OUT = "../docs/onda-01/evidencias";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const results = [];
const ok = (n, c, extra="") => { results.push(`${c?"PASS":"FAIL"} ${n} ${extra}`); };
const browser = await chromium.launch({ headless: true });

async function shot(name, w, h, fn) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on("pageerror", e => results.push("PAGEERROR " + e.message));
  await fn(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await ctx.close();
}

await shot("desktop-captacao", 1440, 900, async (page) => {
  await page.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  ok("desktop carrega captação pública", await page.locator("text=Manifestação de interesse").count() > 0);
  ok("desktop mostra login do escritório", await page.locator("text=acesso do escritório").count() > 0);
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill("Playwright Teste");
  await form.locator("input").nth(1).fill("QA Corp");
  await form.locator("input[type=email]").fill("pw@qa.com");
  await page.click("button:has-text('Enviar manifestação')");
  await page.waitForSelector("text=/Manifestação|manifestação/", { timeout: 8000 });
  ok("desktop formulário captação sucesso", true);
});

await shot("desktop-login-pipeline", 1440, 900, async (page) => {
  await page.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.locator(".card").last().locator("input[type=email]").fill("owner@bgo.local");
  await page.locator(".card").last().locator("input[type=password]").fill(process.env.BGO_TEST_PASSWORD ?? "bgo-dev-local-2026");
  await page.click("button:has-text('Entrar')");
  await page.waitForSelector("text=Fluxo demonstrativo", { timeout: 8000 });
  ok("desktop login + dashboard", true);
  await page.click("button:has-text('Rodar fluxo demo')");
  await page.waitForSelector("text=Aprovação pendente", { timeout: 10000 });
  ok("desktop demo run", true);
  await page.click("nav >> text=Aprovações");
  await page.waitForSelector("button:has-text('Aprovar')", { timeout: 8000 });
  ok("desktop aba aprovações", await page.locator("button:has-text('Aprovar')").count() > 0);
  await page.click("nav >> text=Leads");
  await page.waitForSelector("text=pw@qa.com", { timeout: 5000 });
  ok("desktop lead real visível", await page.locator("text=REAL").count() > 0);
  ok("desktop selo SIMULAÇÃO presente", await page.locator(".sim-badge").count() > 0);
  await page.click("nav >> text=Agentes (6)");
  await page.waitForSelector(".agent-card", { timeout: 8000 });
  ok("desktop aba agentes (6 cards)", await page.locator(".agent-card").count() === 6);
});

await shot("mobile-captacao", 390, 844, async (page) => {
  await page.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  ok("mobile carrega captação+login", await page.locator("text=Manifestação de interesse").count() > 0 && await page.locator("text=acesso do escritório").count() > 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 5);
  ok("mobile sem overflow horizontal", !overflow);
});

await browser.close();
console.log(results.join("\n"));
