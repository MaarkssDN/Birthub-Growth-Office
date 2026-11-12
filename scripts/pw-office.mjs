import { chromium } from "playwright-core";
const OUT = "docs/onda-03/evidencias";
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const results = [];
const ok = (n, c, extra = "") => results.push(`${c ? "PASS" : "FAIL"} ${n} ${extra}`);
const browser = await chromium.launch({ executablePath: EDGE, headless: true });

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => results.push("PAGEERROR " + e.message));
page.on("console", (m) => { if (m.type() === "error") results.push("CONSOLE-ERR " + m.text().slice(0, 160)); });

await page.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
await page.locator(".card").last().locator("input[type=email]").fill("owner@bgo.local");
await page.locator(".card").last().locator("input[type=password]").fill("dev-local-only");
await page.click("button:has-text('Entrar')");
await page.waitForSelector("text=Fluxo demonstrativo", { timeout: 8000 });
ok("login", true);

await page.click("nav >> text=Escritório");
await page.waitForSelector(".office-stage canvas", { timeout: 15000 });
await page.waitForTimeout(2500); // cena montar + labels
ok("canvas WebGL renderizado", await page.locator(".office-stage canvas").count() > 0);
ok("6 agentes no painel", await page.locator(".office-agent").count() === 6);
ok("badge SIMULAÇÃO", await page.locator(".office-hud .badge.gold").count() > 0);
await page.screenshot({ path: `${OUT}/office-3d-inicial.png`, fullPage: false });

// selecionar Aegis
await page.locator(".office-agent", { hasText: "Aegis" }).first().click();
await page.waitForTimeout(400);
ok("detalhe do agente selecionado", await page.locator(".office-detail h3").count() > 0);
await page.screenshot({ path: `${OUT}/office-3d-aegis.png`, fullPage: false });

// executar missão demo → eventos reais devem animar bonequinhos
await page.click("button:has-text('Executar missão demo')");
await page.waitForTimeout(6000);
const states = await page.locator(".office-agent .badge").allTextContents();
ok("estados reativos após eventos", states.some((s) => /processando|comunicando|sucesso|erro|atento/.test(s)), states.join(","));
await page.screenshot({ path: `${OUT}/office-3d-pos-missao.png`, fullPage: false });

// mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mctx.newPage();
mp.on("pageerror", (e) => results.push("MOBILE PAGEERROR " + e.message));
await mp.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
await mp.locator(".card").last().locator("input[type=email]").fill("owner@bgo.local");
await mp.locator(".card").last().locator("input[type=password]").fill("dev-local-only");
await mp.click("button:has-text('Entrar')");
await mp.waitForSelector("text=Fluxo demonstrativo", { timeout: 8000 });
await mp.click("nav >> text=Escritório");
await mp.waitForTimeout(3000);
ok("mobile canvas ou fallback", (await mp.locator(".office-stage canvas, .office-nogl").count()) > 0);
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
ok("mobile sem overflow horizontal", !overflow);
await mp.screenshot({ path: `${OUT}/office-3d-mobile.png`, fullPage: true });

await browser.close();
console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL") || r.includes("ERROR"));
console.log(fails.length ? `\n${fails.length} FALHAS` : "\nTODOS PASS");
process.exit(fails.length ? 1 : 0);
