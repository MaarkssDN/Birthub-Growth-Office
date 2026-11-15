import { chromium } from "playwright-core";
import { resolve } from "node:path";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Screenshot 1: Public portal (closed modal)
await page.screenshot({ path: resolve("docs/onda-14/evidencias/portal-publico-desktop.png"), fullPage: true });

// Screenshot 2: Open modal
const modalBtn = page.locator("button:has-text('Solicitar Demonstração'), button:has-text('Manifestar')").first();
await modalBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: resolve("docs/onda-14/evidencias/modal-captacao-desktop.png") });

// Screenshot 3: Mobile
const mPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mPage.goto("http://127.0.0.1:4180/", { waitUntil: "domcontentloaded" });
await mPage.waitForTimeout(1500);
await mPage.screenshot({ path: resolve("docs/onda-14/evidencias/portal-publico-mobile.png"), fullPage: true });

await browser.close();
console.log("Screenshots do portal público capturadas!");
