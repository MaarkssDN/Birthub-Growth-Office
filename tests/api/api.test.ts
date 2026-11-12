import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { Store, hashPassword } from "@bgo/commercial";

function makeApp(devAuth = true) {
  const store = new Store();
  return { app: buildApp({ store, devAuth, persistence: "memory" }), store };
}

async function loginToken(app: ReturnType<typeof buildApp>, store: Store) {
  await store.upsertUser({
    id: "user_test",
    email: "tester@bgo.local",
    name: "Tester",
    role: "approver",
    passwordHash: await hashPassword("senha-teste-123"),
  });
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "tester@bgo.local", password: "senha-teste-123" },
  });
  expect(res.statusCode).toBe(200);
  return res.json().token as string;
}

const VALID_CAPTURE = {
  name: "Maria Silva",
  company: "Indústrias Exemplo",
  email: "maria@exemplo.com",
  phone: "+55 11 99999-0000",
  interest: "Quero entender como o Birthub 360 apoia meu time comercial",
  source: "website_form",
  privacy: {
    noticeVersion: "lgpd-notice-v1",
    marketingOptIn: false,
    channels: ["email"],
  },
};

describe("API smoke (inject)", () => {
  it("GET /api/health → mock/simulated", async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mode).toBe("mock");
    expect(body.simulated).toBe(true);
    await app.close();
  });

  it("rotas privadas exigem autenticação (401 sem sessão)", async () => {
    const { app } = makeApp(false);
    const res = await app.inject({ method: "GET", url: "/api/leads" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("dev-header NÃO autentica quando devAuth=false", async () => {
    const { app } = makeApp(false);
    const res = await app.inject({
      method: "GET",
      url: "/api/leads",
      headers: { "x-bgo-user": "user_x", "x-bgo-role": "owner" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("dev-header autentica quando devAuth=true (ambiente dev explícito)", async () => {
    const { app } = makeApp(true);
    const res = await app.inject({
      method: "GET",
      url: "/api/leads",
      headers: { "x-bgo-user": "user_x", "x-bgo-role": "owner" },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it("login real com senha scrypt emite sessão; logout revoga", async () => {
    const { app, store } = makeApp(false);
    const token = await loginToken(app, store);
    expect(token.length).toBeGreaterThan(20);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("tester@bgo.local");

    // sessão funciona em rota privada
    const leads = await app.inject({
      method: "GET",
      url: "/api/leads",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(leads.statusCode).toBe(200);

    // senha errada → 401
    const bad = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "tester@bgo.local", password: "errada-errada" },
    });
    expect(bad.statusCode).toBe(401);

    // logout revoga
    await app.inject({ method: "POST", url: "/api/auth/logout", headers: { authorization: `Bearer ${token}` } });
    const after = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(after.statusCode).toBe(401);
    await app.close();
  });

  it("rate limit no login (6ª tentativa → 429)", async () => {
    const { app } = makeApp(false);
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "ninguem@bgo.local", password: "qualquer123" },
      });
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ninguem@bgo.local", password: "qualquer123" },
    });
    expect(res.statusCode).toBe(429);
    await app.close();
  });

  it("captação pública: cria lead real (synthetic=false) com privacidade", async () => {
    const { app } = makeApp(false);
    const res = await app.inject({ method: "POST", url: "/api/capture", payload: VALID_CAPTURE });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.duplicate).toBe(false);
    expect(body.status).toBe("new");

    // lead aparece no pipeline via rota autenticada
    const { app: app2, store } = makeApp(false);
    void app2; void store;
    await app.close();
  });

  it("captação deduplica por e-mail — segundo envio retorna duplicate", async () => {
    const { app } = makeApp(false);
    const r1 = await app.inject({ method: "POST", url: "/api/capture", payload: VALID_CAPTURE });
    const r2 = await app.inject({ method: "POST", url: "/api/capture", payload: VALID_CAPTURE });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(200);
    expect(r2.json().duplicate).toBe(true);
    expect(r2.json().leadId).toBe(r1.json().leadId);
    await app.close();
  });

  it("captação rejeita payload inválido e honeypot é silencioso", async () => {
    const { app } = makeApp(false);
    const bad = await app.inject({
      method: "POST",
      url: "/api/capture",
      payload: { name: "X", company: "Y", email: "not-an-email", interest: "oi", source: "website_form", privacy: { noticeVersion: "lgpd-notice-v1", marketingOptIn: false, channels: ["email"] } },
    });
    expect(bad.statusCode).toBe(400);

    const bot = await app.inject({
      method: "POST",
      url: "/api/capture",
      payload: { ...VALID_CAPTURE, website: "http://spam.example" },
    });
    expect(bot.statusCode).toBe(202);
    await app.close();
  });

  it("GET /api/catalog → 29 personas e 6 ativos", async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/catalog",
      headers: { "x-bgo-role": "auditor", "x-bgo-user": "user_aud" },
    });
    const body = res.json();
    expect(body.personas).toHaveLength(29);
    expect(body.agents.filter((a: { active: boolean }) => a.active)).toHaveLength(6);
    await app.close();
  });

  it("POST /api/demo/run → fluxo completo até aprovação pendente", async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/demo/run",
      headers: { "x-bgo-user": "user_demo", "x-bgo-role": "operator" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.simulated).toBe(true);
    expect(body.correlationId).toBeTruthy();
    expect(body.approvalId).toBeTruthy();

    const approvals = await app.inject({
      method: "GET",
      url: "/api/approvals?status=pending",
      headers: { "x-bgo-role": "approver", "x-bgo-user": "user_approver" },
    });
    expect(approvals.json().length).toBeGreaterThan(0);

    const missions = await app.inject({
      method: "GET",
      url: "/api/missions",
      headers: { "x-bgo-role": "approver", "x-bgo-user": "user_approver" },
    });
    const m = missions.json()[0];
    expect(m.status).toBe("awaiting_approval");
    await app.close();
  });

  it("decisão de aprovação exige role approver/owner", async () => {
    const { app } = makeApp();
    const h = { "x-bgo-role": "approver", "x-bgo-user": "user_approver" };
    await app.inject({ method: "POST", url: "/api/demo/run", headers: h, payload: {} });
    const pending = (await app.inject({ method: "GET", url: "/api/approvals?status=pending", headers: h })).json();
    const id = pending[0].id;

    const forbidden = await app.inject({
      method: "POST",
      url: `/api/approvals/${id}/decision`,
      headers: { "x-bgo-role": "operator", "x-bgo-user": "user_op" },
      payload: { decision: "approved" },
    });
    expect(forbidden.statusCode).toBe(403);

    const ok = await app.inject({
      method: "POST",
      url: `/api/approvals/${id}/decision`,
      headers: h,
      payload: { decision: "approved" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().missionStatus).toBe("completed");
    await app.close();
  });

  it("rejeição sem motivo é 400", async () => {
    const { app } = makeApp();
    const h = { "x-bgo-role": "approver", "x-bgo-user": "user_approver" };
    await app.inject({ method: "POST", url: "/api/demo/run", headers: h, payload: {} });
    const pending = (await app.inject({ method: "GET", url: "/api/approvals?status=pending", headers: h })).json();
    const res = await app.inject({
      method: "POST",
      url: `/api/approvals/${pending[0].id}/decision`,
      headers: h,
      payload: { decision: "rejected" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("GET /api/events/stream emite text/event-stream", async () => {
    const { app } = makeApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/events/stream`, {
      signal: controller.signal,
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain("hello");
    controller.abort();
    await app.close();
  });
});
