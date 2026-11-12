# BGO · Onda 00 — Eventos e Aprovações

## 1. Envelope de evento (Zod: `packages/contracts/src/event.ts`)

```json
{
  "eventId": "uuid",
  "eventType": "mission.assigned.v1",
  "version": 1,
  "workspaceId": "birthub-growth",
  "missionId": "uuid?",
  "agentId": "relay?",
  "occurredAt": "ISO-8601",
  "correlationId": "uuid",
  "payload": { "...": "validado por schema do evento" }
}
```

Eventos versionados da onda:
`lead.created.v1`, `lead.qualified.v1`, `mission.created.v1`,
`mission.assigned.v1`, `run.started.v1`, `run.step.completed.v1`,
`draft.created.v1`, `approval.requested.v1`, `approval.decided.v1`,
`run.completed.v1`, `run.failed.v1`, `audit.denied.v1` (tentativa bloqueada).

PII: `payload` validado por schema estrito; campos de contato passam por
`redactPII` antes de persistir/publicar (email→`e***@dominio`, phone→`***1234`).

## 2. EventOutbox

Todo evento é gravado em `EventOutbox` **na mesma operação** da mutação
(padrão outbox), depois publicado para listeners in-process e SSE.
`publishedAt` nulo = pendente (crash-safe).

## 3. SSE

`GET /api/events/stream` — `text/event-stream`, emite envelopes completos.
Frontend reconecta com `Last-Event-ID` (eventId) e rebusca via
`GET /api/events?after=<occurredAt>` em caso de gap.

## 4. ApprovalRequest

Fluxo: agente/serviço solicita → `approval.requested.v1` + status da missão
`awaiting_approval` → humano `POST /api/approvals/:id/decision`
(`{decision: approved|rejected, reason}`) → `approval.decided.v1` + missão
retoma ou é cancelada.

Regras:
- Somente roles `owner|approver` decidem; `operator` pode solicitar.
- `reason` obrigatória em rejeição (preservada para auditoria).
- Auto-aprovação proibida: `requestedBy == approverId` → denied + audit.
- Aprovação **não** executa envio: `channel.send` permanece bloqueado na W00.
- Expiração opcional (`expiresAt`); expirado = denied automático.

## 5. Matriz de decisão (resumo)

| Ação | Sem aprovação | Com aprovação humana | W00 |
|------|---------------|----------------------|-----|
| lead.create/update interno | L2 permitido | — | permitido |
| mission.plan/delegate | L2 permitido | — | permitido |
| draft.create | L2 permitido | — | permitido (SIMULADO) |
| channel.send (email/whatsapp) | **negado** | L3 exigiria integração real | **negado sempre** |
| payment/contract/mass_send | **negado** | — | **negado (L4)** |
| policy.modify/infra/cross_tenant | **negado** | — | **negado (L4)** |
