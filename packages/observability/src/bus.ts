import { randomUUID } from "node:crypto";
import {
  EventEnvelope,
  validateEventPayload,
  redactPII,
  type EventType,
} from "@bgo/contracts";

export interface StoredEvent extends EventEnvelope {
  publishedAt?: string;
}

export type EventListener = (event: StoredEvent) => void;

/** Barramento de eventos: valida envelope+payload, redact PII, distribui. */
export class EventBus {
  private listeners = new Set<EventListener>();
  private history: StoredEvent[] = [];

  subscribe(fn: EventListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(input: {
    eventType: EventType;
    workspaceId: string;
    correlationId: string;
    payload: Record<string, unknown>;
    missionId?: string;
    agentId?: string;
    occurredAt?: string;
  }): StoredEvent {
    const payloadCheck = validateEventPayload(input.eventType, input.payload);
    if (!payloadCheck.ok) {
      throw new Error(`payload inválido para ${input.eventType}: ${payloadCheck.error}`);
    }
    const event: StoredEvent = EventEnvelope.parse({
      eventId: randomUUID(),
      eventType: input.eventType,
      version: 1,
      workspaceId: input.workspaceId,
      ...(input.missionId !== undefined ? { missionId: input.missionId } : {}),
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      correlationId: input.correlationId,
      payload: redactPII(input.payload),
    });
    this.history.push(event);
    for (const fn of this.listeners) fn(event);
    return event;
  }

  list(filter?: { correlationId?: string; eventType?: string; after?: string; limit?: number }): StoredEvent[] {
    let out = this.history;
    if (filter?.correlationId) out = out.filter((e) => e.correlationId === filter.correlationId);
    if (filter?.eventType) out = out.filter((e) => e.eventType === filter.eventType);
    if (filter?.after) out = out.filter((e) => e.occurredAt > filter.after!);
    const limit = filter?.limit ?? 500;
    return out.slice(-limit);
  }

  clear(): void {
    this.history = [];
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
