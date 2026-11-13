import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regeneração segura do Prisma Client no Windows (Onda 11 / Fase 07 - G140).
 *
 * Problema diagnosticado na Onda 10:
 * `prisma generate` tenta renomear `query_engine-windows.dll.node.tmp*` ->
 * `query_engine-windows.dll.node`, falhando com EPERM quando um processo
 * Node do próprio BGO (`apps/api` ou `apps/worker`) mantém a DLL carregada.
 *
 * Solução segura:
 * 1. Lista apenas processos `node.exe` cujo CommandLine pertence a este
 *    repositório (`Birthub-Growth-Office`) e carrega o Prisma (`apps/api` ou `apps/worker`).
 * 2. NUNCA encerra processos `node.exe` externos ou de outros projetos.
 * 3. Encerra de forma seletiva apenas os processos BGO que bloqueiam a DLL,
 *    executa `prisma migrate deploy` (se solicitado) e `prisma generate`,
 *    e valida o cliente gerado contra `prisma/schema.prisma`.
 */

const REPO_ROOT = resolve(import.meta.dirname, "..");

function findBlockingBgoProcesses() {
  if (process.platform !== "win32") return [];
  const psScript = `
    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
      Select-Object ProcessId, ParentProcessId, CommandLine |
      ConvertTo-Json -Compress
  `;
  const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", psScript], {
    encoding: "utf8",
  }).trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.filter((p) => {
    const cmd = String(p.CommandLine ?? "");
    const isThisRepo = cmd.toLowerCase().includes("birthub-growth-office");
    const isApiOrWorker =
      cmd.includes("apps\\api") ||
      cmd.includes("apps/api") ||
      cmd.includes("apps\\worker") ||
      cmd.includes("apps/worker") ||
      cmd.includes("src/index.ts");
    const isSelf = Number(p.ProcessId) === process.pid;
    return isThisRepo && isApiOrWorker && !isSelf;
  });
}

function stopBlockingProcesses(procs) {
  for (const p of procs) {
    try {
      console.log(`[prisma-safe] encerrando processo BGO bloqueante PID=${p.ProcessId}: ${p.CommandLine.slice(0, 100)}`);
      process.kill(Number(p.ProcessId), "SIGTERM");
    } catch {
      // processo já encerrado
    }
  }
}

async function main() {
  const deploy = process.argv.includes("--deploy");
  const blocking = findBlockingBgoProcesses();
  if (blocking.length > 0) {
    console.log(`[prisma-safe] ${blocking.length} processo(s) BGO mantendo Prisma Engine DLL aberto.`);
    stopBlockingProcesses(blocking);
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    console.log("[prisma-safe] nenhum processo BGO bloqueando o Prisma Engine DLL.");
  }

  if (deploy) {
    console.log("[prisma-safe] aplicando migrations pendentes (prisma migrate deploy)...");
    const m = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: true,
    });
    if (m.status !== 0) {
      throw new Error(`prisma migrate deploy falhou com código ${m.status}`);
    }
  }

  console.log("[prisma-safe] executando prisma generate...");
  const g = spawnSync("pnpm", ["exec", "prisma", "generate"], {
    cwd: REPO_ROOT,
     encoding: "utf8",
    shell: true,
  });
  process.stdout.write(g.stdout ?? "");
  process.stderr.write(g.stderr ?? "");
  if (g.status !== 0 || (g.stderr ?? "").includes("EPERM")) {
    throw new Error(`prisma generate falhou ou encontrou EPERM (status=${g.status})`);
  }

  // Verificar que o cliente gerado contém os modelos do schema atual
  const pnpmDir = resolve(REPO_ROOT, "node_modules/.pnpm");
  const prismaPkgDir = readdirSync(pnpmDir).find((d) => d.startsWith("@prisma+client@"));
  if (!prismaPkgDir) throw new Error("diretório @prisma+client não encontrado em node_modules/.pnpm");
  const dtsPath = resolve(pnpmDir, prismaPkgDir, "node_modules/.prisma/client/index.d.ts");
  const dts = readFileSync(dtsPath, "utf8");
  const requiredModels = [
    "Workspace",
    "Lead",
    "Opportunity",
    "OpportunityHistory",
    "Mission",
    "ExecutionRun",
    "ApprovalRequest",
    "CommercialDraft",
    "ImportBatch",
    "Company",
    "CompanyHistory",
    "AiTariff",
    "AiUsageRecord",
  ];
  const missing = requiredModels.filter((m) => !dts.includes(`export type ${m} =`));
  if (missing.length > 0) {
    throw new Error(`cliente Prisma gerado incompleto; modelos ausentes: ${missing.join(", ")}`);
  }
  console.log(`[prisma-safe] OK — cliente Prisma validado com todos os ${requiredModels.length} modelos e zero EPERM.`);
}

main().catch((err) => {
  console.error("[prisma-safe] ERRO:", err.message);
  process.exit(1);
});
