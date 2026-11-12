import { buildApp } from "./app";
import { Store, type StorePort } from "@bgo/commercial";

const port = Number(process.env.BGO_API_PORT ?? 4181);
const host = process.env.BGO_API_HOST ?? "127.0.0.1";
const devAuth = process.env.BGO_DEV_AUTH === "1";

async function main() {
  let store: StorePort;
  let persistence: "memory" | "postgres" = "memory";

  if (process.env.BGO_PERSISTENCE !== "memory") {
    try {
      const { PrismaStore } = await import("@bgo/db/store");
      let handle: { dataDir: string } | undefined;
      if (!process.env.DATABASE_URL) {
        // modo embutido: API é dona do PGlite (dataDir trancado por processo)
        const { startPglite, databaseUrlFor } = await import("@bgo/db");
        handle = await startPglite();
        process.env.DATABASE_URL = databaseUrlFor();
      }
      const prismaStore = new PrismaStore();
      await prismaStore.init();
      store = prismaStore;
      persistence = "postgres";
      console.log(`[bgo-api] persistência PostgreSQL via ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@")} ${handle ? `(PGlite ${handle.dataDir})` : "(servidor externo)"}`);
    } catch (e) {
      console.warn(`[bgo-api] persistência indisponível (${(e as Error).message}) — caindo para memória (volátil)`);
      store = new Store();
    }
  } else {
    store = new Store();
  }

  const app = buildApp({ store, devAuth, persistence });
  await app.listen({ port, host });
  console.log(
    `[bgo-api] ${persistence === "postgres" ? "postgres" : "MOCK/memória"} em http://${host}:${port}` +
      (devAuth ? " — DEV-AUTH ATIVO (apenas desenvolvimento)" : " — auth real obrigatória"),
  );
}

void main();
