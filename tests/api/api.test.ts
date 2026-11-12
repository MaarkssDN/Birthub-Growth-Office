import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { Store } from "@bgo/commercial";

function makeApp() {
  const store = new Store();
  return { app: buildApp({ store }), store };
}

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

  it("GET /api/catalog → 29 personas e 6 ativos", async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: "GET", url: "/api/catalog" });
    const body = res.json();
    expect(body.personas).toHaveLength(29);
    expect(body.agents.filter((a: { active: boolean }) => a.active)).toHaveLength(6);
    await app.close();
  });

  it("POST /api/demo/run → fluxo completo até aprovação pendente", async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: "POST", url: "/api/demo/run", payload: {} });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.simulated).toBe(true);
    expect(body.correlationId).toBeTruthy();
    expect(body.approvalId).toBeTruthy();

    const approvals = await app.inject({ method: "GET", url: "/api/approvals?status=pending" });
    expect(approvals.json().length).toBeGreaterThan(0);

    const missions = await app.inject({ method: "GET", url: "/api/missions" });
    const m = missions.json()[0];
    expect(m.status).toBe("awaiting_approval");
    await app.close();
  });

  it("decisão de aprovação exige role approver/owner", async () => {
    const { app } = makeApp();
    await app.inject({ method: "POST", url: "/api/demo/run", payload: {} });
    const pending = (await app.inject({ method: "GET", url: "/api/approvals?status=pending" })).json();
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
      headers: { "x-bgo-role": "approver", "x-bgo-user": "user_approver" },
      payload: { decision: "approved" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().missionStatus).toBe("completed");
    await app.close();
  });

  it("rejeição sem motivo é 400", async () => {
    const { app } = makeApp();
    await app.inject({ method: "POST", url: "/api/demo/run", payload: {} });
    const pending = (await app.inject({ method: "GET", url: "/api/approvals?status=pending" })).json();
    const res = await app.inject({
      method: "POST",
      url: `/api/approvals/${pending[0].id}/decision`,
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
