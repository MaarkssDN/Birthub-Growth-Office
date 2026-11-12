import { describe, expect, it } from "vitest";
import { Store, runDemoFlow, decideApproval, type DemoFlowResult } from "@bgo/commercial";
import { eventBus } from "@bgo/observability";

function fresh() {
  eventBus.clear();
  return new Store();
}

describe("fluxo demo E2E (G05/G06)", () => {
  let result: DemoFlowResult;
  let store: Store;

  it("lead sintético percorre jornada até aprovação pendente", async () => {
    store = fresh();
    result = await runDemoFlow(store);

    expect(result.simulated).toBe(true);
    expect(result.lead.synthetic).toBe(true);
    expect(result.lead.status).toBe("qualified");
    expect(result.mission.status).toBe("awaiting_approval");
    expect(result.draft.simulated).toBe(true);
    expect(result.draft.status).toBe("draft");
    expect(result.rubric.rubricVersion).toBe("rubric-v1");
    expect(result.rubric.gaps.length).toBeGreaterThan(0); // lacunas honestas
  });

  it("eventos versionados com correlationId único e coerente", () => {
    const events = eventBus.list({ correlationId: result.correlationId });
    const types = events.map((e) => e.eventType);
    for (const t of [
      "lead.created.v1", "mission.created.v1", "mission.assigned.v1",
      "run.started.v1", "run.step.completed.v1", "lead.qualified.v1",
      "draft.created.v1", "approval.requested.v1", "mission.status_changed.v1",
    ]) {
      expect(types).toContain(t);
    }
    for (const e of events) {
      expect(e.correlationId).toBe(result.correlationId);
      expect(e.version).toBe(1);
      expect(e.workspaceId).toBe("birthub-growth");
      expect(e.occurredAt).toBeTruthy();
    }
    // run.failed.v1 deve existir: Beacon tentou channel.send e foi negado
    expect(types).toContain("run.failed.v1");
    expect(types).toContain("audit.denied.v1");
  });

  it("tentativa de envio externo fica registrada como denied na auditoria", async () => {
    const denied = await store.listAudit({ outcome: "denied" });
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.some((a) => a.action.includes("channel.send"))).toBe(true);
  });

  it("decisão humana aprova draft e completa missão — sem envio", async () => {
    const { missionStatus } = await decideApproval(
      store, result.approvalId, "approved", "user_approver",
    );
    expect(missionStatus).toBe("completed");
    expect((await store.getDraft(result.draft.id))!.status).toBe("approved");
    // draft aprovado continua simulated e nunca "sent"
    expect((await store.getDraft(result.draft.id))!.simulated).toBe(true);
    expect((await store.getDraft(result.draft.id))!.status).not.toBe("sent_blocked");
  });

  it("auto-aprovação é negada e auditada", async () => {
    const store2 = fresh();
    const r2 = await runDemoFlow(store2);
    const approval = (await store2.getApproval(r2.approvalId))!;
    await expect(
      decideApproval(store2, r2.approvalId, "approved", approval.requestedBy),
    ).rejects.toThrow(/auto-aprovação/i);
    expect((await store2.listAudit({ outcome: "denied" })).some((a) => a.action === "approval.self_decide")).toBe(true);
  });

  it("rejeição exige motivo e cancela missão", async () => {
    const store3 = fresh();
    const r3 = await runDemoFlow(store3);
    const { missionStatus } = await decideApproval(store3, r3.approvalId, "rejected", "user_approver", "tom incompatível");
    expect(missionStatus).toBe("cancelled");
    expect((await store3.getDraft(r3.draft.id))!.status).toBe("rejected");
  });
});
