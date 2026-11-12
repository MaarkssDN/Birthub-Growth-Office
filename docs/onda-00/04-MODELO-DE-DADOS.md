# BGO · Onda 00 — Modelo de Dados

Prisma schema-alvo: `prisma/schema.prisma` (não migrado — Docker indisponível).
Implementação vigente: `PersistenceAdapter` in-memory com os mesmos campos.

## Entidades mínimas

| Entidade | Campos essenciais / regra |
|----------|---------------------------|
| Workspace | `id`, `slug='birthub-growth'`, `ownerId`, `status`, timestamps. Único na W00; schema preparado p/ multi-org futuro, **sem SaaS** |
| User | `id`, `email`, `name`, `passwordHash` (seed local), `roleId` |
| Role | `owner`, `operator`, `approver`, `auditor` — RBAC mínimo |
| OfferClaim | `claim`, `evidenceUrl?`, `status[approved,pending,rejected]`, `version`, `approvedBy?` |
| ICPProfile | `segments`, `pains`, `excludes`, `scoreRubric`, `revision`, `validatedAt?` (null = hipótese) |
| Lead | `id`, `workspaceId`, `source`, `sourceUrl?`, `capturedAt`, `status`, `name?`, `email?`, `phone?`, `synthetic`, `provenance{source,at,legalBasis}`, `consent{channel,optIn,at}`, `suppressedAt?` |
| LeadSource | catálogo de origens (`demo_form`, `indication`, `content`, `synthetic`) |
| ChannelPermission | `channel`, `optInRequired`, `templatesRequired`, `allowed` |
| Opportunity | `leadId`, `stage`, `nextAction`, `lastActivityAt`, `owner`, `amount?` (sempre null W00) |
| Task | `missionId`, `assigneeAgentId`, `title`, `status`, `dueAt?`, `dependsOn[]`, `correlationId` |
| Mission | `requester`, `goal`, `status`, `correlationId`, `leadId?` |
| AgentDefinition | `agentId`, `personaId?`, `capabilities`, `autonomyCeiling` |
| AgentAssignment | `missionId`, `agentId`, `role`, `assignedBy`, `at` |
| ExecutionRun | `agentId`, `missionId`, `provider`, `mock=true`, `status`, `costUnits=0`, `correlationId` |
| ExecutionStep | `runId`, `seq`, `tool`, `action`, `inputRef`, `outputRef`, `decision`, `at` |
| ApprovalRequest | `action`, `scope`, `reason`, `preview`, `requestedBy`, `approverRole`, `decision?`, `decidedBy?`, `decidedAt?`, `expiresAt?` |
| CommercialDraft | `channel`, `recipientPolicy`, `template?`, `claimRefs[]`, `text`, `status[draft,approved,rejected,sent_blocked]` — **sem envio na W00** |
| EventOutbox | `eventId`, `eventType`, `version`, `payload`, `publishedAt?`, `correlationId` |
| AuditEvent | `id`, `actor`, `action`, `entity`, `entityId`, `occurredAt`, `correlationId`, `redactedPayload`, `outcome[allowed,denied,info]` |

## Status de Lead (máquina explícita)

`new → triage → qualified | nurture → meeting_requested → proposal → won | lost`
`qualquer → suppressed` (opt-out; terminal para contato, preserva registro).

Transições implementadas em `packages/commercial/src/lead-machine.ts` e
validadas por teste: transição inválida lança `InvalidTransition` e gera
`AuditEvent outcome=denied`.

## Status de Missão

`draft → queued → running → (waiting_input | awaiting_approval) → completed`
`running → failed | cancelled` (de qualquer não-terminal).

## Regras transversais

- Todo registro: `id`, `createdAt`, `updatedAt`, `workspaceId`, `createdBy`.
- Contato: provenance + uso permitido + minimização + exclusão/correção.
- Eventos: envelope versionado (ver doc 05); PII passa por `redactPII`.
- Auditoria append-only: `AuditEvent` nunca é atualizado nem apagado.
