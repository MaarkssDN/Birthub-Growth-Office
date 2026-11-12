import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Servidor PostgreSQL local isolado via PGlite (Postgres real em WASM).
 * - Dados persistidos em disco no diretório do projeto (var/pglite).
 * - Socket TCP somente em 127.0.0.1:5437 — nunca LAN.
 * - Nome do banco alvo: birthub_growth_office_dev (criado se ausente).
 */
export const PGLITE_HOST = "127.0.0.1";
export const PGLITE_PORT = 5437;
export const PGLITE_DATABASE = "birthub_growth_office_dev";
// dataDir sempre na raiz do monorepo, independente do cwd do processo
const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATA_DIR = resolve(here, "..", "..", "..", "var", "pglite");

export interface PgliteHandle {
  db: PGlite;
  server: PGLiteSocketServer;
  dataDir: string;
  databaseUrl: string;
}

let handle: PgliteHandle | undefined;
let guardInstalled = false;

/**
 * O socket do PGlite pode emitir ECONNRESET quando um cliente (Prisma) fecha a
 * conexão de forma abrupta. Isso é normal em Postgres — não deve derrubar o
 * servidor. Filtramos apenas erros de socket transitórios.
 */
function installDisconnectGuard(): void {
  if (guardInstalled) return;
  guardInstalled = true;
  process.on("unhandledRejection", (reason) => {
    const code = (reason as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ECONNRESET" || code === "ECONNABORTED" || code === "EPIPE") return;
    console.error("[pglite] unhandled rejection:", reason);
  });
}

export function databaseUrlFor(port = PGLITE_PORT): string {
  return `postgresql://postgres:postgres@127.0.0.1:${port}/${PGLITE_DATABASE}?sslmode=disable&connection_limit=1`;
}

export async function startPglite(dataDir = DEFAULT_DATA_DIR): Promise<PgliteHandle> {
  if (handle) return handle;
  installDisconnectGuard();
  mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create({ dataDir, debug: 0 });

  // NOTA: o socket do PGlite ignora o nome do database no startup — todas as
  // conexões caem no banco interno da instância. A identidade BGO é garantida
  // por: dataDir exclusivo + porta 127.0.0.1:5437 + tabela-marca _bgo_instance
  // verificada em PrismaStore.init(). PGLITE_DATABASE permanece no DATABASE_URL
  // por documentação e para o caso de troca futura por Postgres real.

  const server = new PGLiteSocketServer({
    db,
    port: PGLITE_PORT,
    host: PGLITE_HOST,
    // PGliteSocketServer aceita `database` opcional para multi-db
  });
  await server.start();

  handle = { db, server, dataDir, databaseUrl: databaseUrlFor() };
  return handle;
}

export async function stopPglite(): Promise<void> {
  if (!handle) return;
  await handle.server.stop().catch(() => undefined);
  await handle.db.close().catch(() => undefined);
  handle = undefined;
}

export async function pgliteStatus(): Promise<{ running: boolean; dataDir: string; port: number }> {
  return { running: handle !== undefined, dataDir: handle?.dataDir ?? DEFAULT_DATA_DIR, port: PGLITE_PORT };
}
