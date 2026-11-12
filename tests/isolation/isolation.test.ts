import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(__dirname, "..", "..");
const SELF = fileURLToPath(import.meta.url);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "references"]);
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".json", ".md", ".yml", ".yaml", ".prisma", ".html", ".css", ".example", ".txt"]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function readSafe(p: string): string | null {
  try { return readFileSync(p, "utf8"); } catch { return null; }
}

describe("isolamento do Birthub 360° (G01/G08)", () => {
  it("nenhum arquivo referencia caminho/repo do Birthub 360°", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      if (file === SELF) continue;
      const ext = file.slice(file.lastIndexOf("."));
      if (!TEXT_EXT.has(ext) && !file.endsWith(".env.example") && !file.endsWith("Dockerfile")) continue;
      const content = readSafe(file);
      if (!content) continue;
      // padrões de dependência externa proibidos (nome do produto vendido é permitido)
      if (/Birthub[-_ ]?360.*(import|require|from\s+["'])/i.test(content)) offenders.push(file);
      if (/github\.com[:/][^\s"']*birthub/i.test(content) && !relative(ROOT, file).startsWith("docs")) offenders.push(file);
      if (/\.\.[\\/]Birthub/i.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("sem endpoints Docker inseguros ou binds de rede", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      if (file === SELF) continue;
      const content = readSafe(file);
      if (!content) continue;
      if (/tcp:\/\/192\.168\./.test(content)) offenders.push(file);
      if (/:2375\b/.test(content)) offenders.push(file);
      if (/0\.0\.0\.0:5437|0\.0\.0\.0:6387/.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("compose usa nomes e portas exclusivas bgo_/birthub_growth", () => {
    const compose = readSafe(join(ROOT, "infra/compose/docker-compose.yml"));
    expect(compose).toBeTruthy();
    expect(compose).toContain("bgo_postgres");
    expect(compose).toContain("bgo_redis");
    expect(compose).toContain("birthub_growth_office_dev");
    expect(compose).toContain("127.0.0.1:5437");
    expect(compose).toContain("127.0.0.1:6387");
    expect(compose).not.toContain("birthub_360");
  });

  it(".env.example não contém segredos reais", () => {
    const env = readSafe(join(ROOT, ".env.example"));
    expect(env).toBeTruthy();
    expect(env).not.toMatch(/postgres(?:ql)?:\/\/[^:\s]+:(?!CHANGE_ME)[^@\s]+@/);
    expect(env).toContain("CHANGE_ME");
    expect(env).toContain("trocar-");
  });

  it("workspace e portas configuradas são as do BGO", () => {
    const env = readSafe(join(ROOT, ".env.example"))!;
    expect(env).toContain("BGO_API_PORT=4181");
    expect(env).toContain("BGO_WEB_PORT=4180");
    expect(env).toContain("birthub-growth");
  });
});
