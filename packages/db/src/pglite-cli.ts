import { startPglite, stopPglite, PGLITE_PORT, PGLITE_DATABASE } from "./pglite-server";

const cmd = process.argv[2];
if (cmd === "up") {
  const h = await startPglite();
  console.log(`PGlite ouvindo socket em 127.0.0.1:${PGLITE_PORT} (db alvo: ${PGLITE_DATABASE})`);
  console.log(`dataDir: ${h.dataDir}`);
  console.log("DATABASE_URL=" + h.databaseUrl);
  process.on("SIGINT", async () => { await stopPglite(); process.exit(0); });
  setInterval(() => {}, 60000);
} else {
  console.log("uso: pglite-cli up");
}
