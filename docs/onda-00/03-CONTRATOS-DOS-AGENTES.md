# BGO · Onda 00 — Contratos dos Agentes

## 1. Catálogo canônico (29)

Fonte: `packages/agents/data/catalog-29.json` (cópia fiel de
`BIRTHUB_GROWTH_OFFICE_CATALOGO_29.json`) + loader `packages/agents/src/catalog.ts`.

| Camada | Qtd | IDs |
|--------|-----|-----|
| pillar | 9 | orbit, nexus, aria, vanguard, oracle, core, spark, echo, sudo |
| commercial | 15 | axiom, beacon, meridian, forge, relay, helm, apex, ledger, anchor, seal, cipher, harbinger, scout, pledge, tribunal |
| channel | 4 | vox, scope, tracker, tempo |
| supervision | 1 | aegis |

Invariantes verificadas por teste (`G03`):
- exatamente 29 IDs únicos; 9+15+4+1; nenhum ID concorrente.
- seis ativos: `aegis, relay, scout, meridian, beacon, pledge` — `active: true`.
- `AgentDefinition` (capacidade) ≠ `CharacterPersona` (visual): pilares têm
  `agentId: null` no catálogo e **não** são executores.
- Status de exibição: ativos = `IMPLEMENTADO (mock)`; demais 23 = `PLANEJADO`.

## 2. Equipe ativa — contratos operacionais

| Agente | Missão no fluxo | Pode | Não pode |
|--------|-----------------|------|----------|
| Aegis | Criar/planejar missão, delegar, consolidar | L2 interno | enviar msg, alterar orçamento, aprovar a si mesmo |
| Relay | Quebrar missão em tarefas, SLA, handoffs | L2 interno | ações externas autônomas |
| Scout | Dossiê com fontes/proveniência | L1 análise, L2 registrar rascunho | scraping restrito, dados sensíveis, inventar contatos |
| Meridian | Qualificar com rubrica versionada | L1 recomendar, L2 gravar score | inventar respostas, recusar lead sem política |
| Beacon | Rascunhos com claims aprovados | L1 rascunho, L3 envio (bloqueado W00) | envio autônomo, números sem opt-in |
| Pledge | Tarefas e lembretes internos | L2 lembretes | confirmar reunião sem evidência, follow-up externo |

## 3. Matriz Agent × Tool × Action × Risk × Approval × Permission

Implementada em `packages/agents/src/policy.ts` e coberta por testes negativos
(`tests/policies`). Trechos normativos:

| Agent | Tool | Action | Risk | Approval | Permission |
|-------|------|--------|------|----------|------------|
| aegis | mission.plan | create_mission | low | no | missions.write |
| aegis | approval.self | approve_own | high | — | **denied (L4-ish)** |
| relay | task.dispatch | assign_task | low | no | tasks.write |
| scout | research.web | gather_dossier | medium | no | research.read |
| scout | research.scrape_restricted | scrape | high | — | **denied** |
| meridian | lead.score | apply_rubric | low | no | leads.write |
| beacon | draft.create | create_draft | medium | no | drafts.write |
| beacon | channel.send | send_email/whatsapp | critical | **yes (L3)** | **blocked W00** |
| pledge | task.reminder | create_reminder | low | no | tasks.write |
| pledge | calendar.confirm | confirm_meeting | high | yes | **denied W00** |
| any | payment.*/contract.*/mass_send | * | critical | — | **denied (L4)** |
| any | policy.modify/infra.change/cross_tenant | * | critical | — | **denied (L4)** |

Regra de ouro: **política vive no backend**; botão desabilitado no frontend é
UX, nunca segurança.

## 4. Estados

Execução (`ExecutionRun.status`): `draft, queued, running, waiting_input,
awaiting_approval, completed, failed, cancelled`.

Visual (`AgentVisualState`): `idle, listening, processing, speaking, success,
error` + flags explícitas `awaitingApproval`, `simulated`. Derivado de runs,
nunca animado livremente.

## 5. Eventos emitidos pelo fluxo (versionados)

`lead.created.v1`, `lead.qualified.v1`, `mission.created.v1`,
`mission.assigned.v1`, `run.started.v1`, `run.step.completed.v1`,
`draft.created.v1`, `approval.requested.v1`, `approval.decided.v1`,
`run.completed.v1`, `run.failed.v1` — envelope validado por Zod
(`eventId, eventType, version, workspaceId, missionId?, agentId?, occurredAt,
correlationId, payload`).
