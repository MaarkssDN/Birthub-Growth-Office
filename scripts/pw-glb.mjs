import { chromium } from "playwright-core";
const OUT = "docs/onda-04/evidencias";
// Chromium baixado via playwright-core install
const AGENTS = ["aegis", "relay", "scout", "meridian", "beacon", "pledge"];
const results = [];
const ok = (n, c, extra = "") => results.push(`${c ? "PASS" : "FAIL"} ${n} ${extra}`);
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => results.push("PAGEERROR " + e.message));

const glbResponses = [];
page.on("response", (r) => { if (r.url().includes("/assets/characters/glb/")) glbResponses.push(`${r.status()} ${r.url().split("/").pop()}`); });

await page.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
await page.locator(".card").last().locator("input[type=email]").fill("owner@bgo.local");
await page.locator(".card").last().locator("input[type=password]").fill(process.env.BGO_TEST_PASSWORD ?? "bgo-dev-local-2026");
await page.click("button:has-text('Entrar')");
await page.waitForSelector("text=Fluxo demonstrativo", { timeout: 8000 });
await page.click("nav >> text=Escritório");
await page.waitForSelector(".office-stage canvas", { timeout: 15000 });
await page.waitForTimeout(4000); // GLBs carregam via Suspense

ok("canvas WebGL", await page.locator(".office-stage canvas").count() > 0);
ok("6 agentes no painel", await page.locator(".office-agent").count() === 6);

// cada GLB deve ter sido requisitado e respondido 200
const okGlb = glbResponses.filter((r) => r.startsWith("200"));
ok("6 GLBs servidos (200)", okGlb.length >= 6, `${okGlb.length}/6 — ${glbResponses.join(", ")}`);

// screenshot por agente selecionado
const names = { aegis: "Aegis", relay: "Relay", scout: "Scout", meridian: "Meridian", beacon: "Beacon", pledge: "Pledge" };
for (const id of AGENTS) {
  await page.locator(".office-agent", { hasText: names[id] }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/personagem-${id}.png` });
  ok(`screenshot ${id}`, true);
}
await page.screenshot({ path: `${OUT}/escritorio-glb-geral.png` });

// mobile sanity
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mctx.newPage();
mp.on("pageerror", (e) => results.push("MOBILE PAGEERROR " + e.message));
await mp.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
await mp.locator(".card").last().locator("input[type=email]").fill("owner@bgo.local");
await mp.locator(".card").last().locator("input[type=password]").fill(process.env.BGO_TEST_PASSWORD ?? "bgo-dev-local-2026");
await mp.click("button:has-text('Entrar')");
await mp.waitForSelector("text=Fluxo demonstrativo", { timeout: 8000 });
await mp.click("nav >> text=Escritório");
await mp.waitForTimeout(3500);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
ok("mobile sem overflow", !overflow);
await mp.screenshot({ path: `${OUT}/escritorio-glb-mobile.png`, fullPage: true });

await browser.close();
console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL") || r.includes("ERROR"));
console.log(fails.length ? `\n${fails.length} FALHAS` : "\nTODOS PASS");
process.exit(fails.length ? 1 : 0);
