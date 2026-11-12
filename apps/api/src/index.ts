import { buildApp } from "./app";
import { Store } from "@bgo/commercial";

const port = Number(process.env.BGO_API_PORT ?? 4181);
const host = process.env.BGO_API_HOST ?? "127.0.0.1";

const store = new Store();
const app = buildApp({ store });

app.listen({ port, host }).then(() => {
  console.log(`[bgo-api] mock mode em http://${host}:${port} — SIMULAÇÃO, sem envios externos`);
});
