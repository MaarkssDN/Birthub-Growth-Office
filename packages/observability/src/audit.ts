import { randomUUID } from "node:crypto";
import { redactPII, type AuditEvent } from "@bgo/contracts";
import { eventBus } from "./bus";

export type AuditOutcome = "allowed" | "denied" | "info";

const auditLog: AuditEvent[] = [];

/** AuditEvent append-only: nunca atualizar nem remover. */
export function recordAudit(input: {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  workspaceId?: string;
  correlationId: string;
  payload?: Record<string, unknown>;
  outcome: AuditOutcome;
  publishEvent?: boolean;
}): AuditEvent {
  const event: AuditEvent = {
    id: randomUUID(),
    actor: input.actor,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
    ...(input.payload !== undefined ? { redactedPayload: redactPII(input.payload) } : {}),
    outcome: input.outcome,
  };
  auditLog.push(event);
  if (input.publishEvent !== false && input.workspaceId) {
    const et = input.outcome === "denied" ? "audit.denied.v1" : "audit.recorded.v1";
    const agentId = input.actor.startsWith("agent:") ? input.actor.slice(6) : undefined;
    eventBus.publish({
      eventType: et,
      workspaceId: input.workspaceId,
      correlationId: input.correlationId,
      ...(agentId !== undefined ? { agentId } : {}),
      payload: {
        actor: event.actor,
        action: event.action,
        entity: event.entity,
        outcome: event.outcome,
      },
    });
  }
  return event;
}

export function listAudit(filter?: { correlationId?: string; entity?: string; outcome?: AuditOutcome; limit?: number }): AuditEvent[] {
  let out = auditLog;
  if (filter?.correlationId) out = out.filter((a) => a.correlationId === filter.correlationId);
  if (filter?.entity) out = out.filter((a) => a.entity === filter.entity);
  if (filter?.outcome) out = out.filter((a) => a.outcome === filter.outcome);
  return out.slice(-(filter?.limit ?? 500));
}

export function auditCount(): number {
  return auditLog.length;
}
