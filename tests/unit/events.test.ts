import { describe, expect, it } from "vitest";
import { EventEnvelope, validateEventPayload, redactPII, maskEmail } from "@bgo/contracts";
import { randomUUID } from "node:crypto";

describe("envelope de eventos", () => {
  const base = {
    eventId: randomUUID(),
    eventType: "lead.created.v1",
    version: 1,
    workspaceId: "birthub-growth",
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    payload: { leadId: "x", source: "synthetic", synthetic: true, status: "new" },
  };

  it("aceita envelope válido", () => {
    expect(() => EventEnvelope.parse(base)).not.toThrow();
  });

  it("rejeita versão errada", () => {
    expect(() => EventEnvelope.parse({ ...base, version: 2 })).toThrow();
  });

  it("rejeita eventType desconhecido", () => {
    expect(() => EventEnvelope.parse({ ...base, eventType: "lead.exploded.v9" })).toThrow();
  });

  it("valida payload por tipo de evento", () => {
    expect(validateEventPayload("lead.created.v1", base.payload).ok).toBe(true);
    expect(validateEventPayload("lead.qualified.v1", { wrong: true }).ok).toBe(false);
    expect(
      validateEventPayload("lead.qualified.v1", {
        leadId: "l", score: 80, rubricVersion: "rubric-v1", gaps: [],
      }).ok,
    ).toBe(true);
  });
});

describe("redactPII", () => {
  it("mascara e-mail e telefone em payloads", () => {
    const out = redactPII({ email: "fulano@empresa.com", phone: "+55 11 99999-0000", ok: 1 });
    expect(out.email).toBe("f***@empresa.com");
    expect(out.phone).toBe("***0000");
    expect(out.ok).toBe(1);
  });

  it("maskEmail preserva domínio", () => {
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
    expect(maskEmail("sem-arroba")).toBe("***");
  });
});
