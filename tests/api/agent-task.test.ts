import { describe, expect, it } from "vitest";
import { buildApp } from "../../apps/api/src/app";
import { Store } from "@bgo/commercial";

const auth = { "x-bgo-user": "user:op", "x-bgo-role": "operator" };

describe("POST /api/ai/agent-task (Onda 15)", () => {
  it("executa tarefa supervisionada de agente com auditoria e simulated=true", async () => {
    const app = buildApp({ store: new Store(), devAuth: true, persistence: "memory" });
    const bad = await app.inject({
      method: "POST", url: "/api/ai/agent-task", headers: auth,
      payload: { agentId: "hacker", input: {} },
    });
    expect(bad.statusCode).toBe(400);

    const res = await app.inject({
      method: "POST", url: "/api/ai/agent-task", headers: auth,
      payload: { agentId: "beacon", input: { lead: { name: "Teste" }, claims: ["c1"] }, missionId: "m-agents" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.agentId).toBe("beacon");
    expect(body.simulated).toBe(true);
    expect(body.correlationId).toBeTruthy();

    const strict = buildApp({ store: new Store(), devAuth: false, persistence: "memory" });
    const unauth = await strict.inject({
      method: "POST", url: "/api/ai/agent-task",
      payload: { agentId: "scout", input: {} },
    });
    expect(unauth.statusCode).toBe(401);
    await strict.close();
    await app.close();
  });
});
