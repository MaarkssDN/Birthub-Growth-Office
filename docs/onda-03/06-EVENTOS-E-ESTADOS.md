# Onda 03 — Evidências de Eventos e Estados (G36)

## Fonte real (não simulada)
- `useOfficeEvents` consome `GET /api/events/stream` (SSE) com fallback de
  replay `GET /api/events`. Cada `EventEnvelope` carrega `eventType`,
  `agentId`, `correlationId`, `payload` redigido.
- Eventos relevantes do fluxo demo (verificados no teste E2E):
  `mission.created`, `task.created`, `run.started/completed`,
  `step.started/completed`, `approval.requested`, `draft.created`.

## Mapeamento evento → estado visual
| Evento (padrão) | Estado |
|---|---|
| `*.started`, `*.queued` | processing |
| `*.ready`, `*.completed`, `*.approved` | success |
| `*.failed`, `*.error`, `*.blocked`, `*.rejected` | error |
| `action.requested` | speaking |
| default / outros | idle |

Estados voltam a `idle` após 4s (retorno natural). Painel lateral lista
eventos reais com timestamp e correlationId — nada fabricado.

## Prova Playwright (`scripts/pw-office.mjs`, 8/8)
Login → canvas WebGL → 6 agentes no painel → badge SIMULAÇÃO →
seleção de Aegis → missão demo → **estados reativos mudaram após eventos
reais** (log contém mudanças de `processing`/`success`) → mobile canvas
ou fallback → sem overflow horizontal.

## Screenshots
`evidencias/office-3d-inicial.png`, `office-3d-aegis.png`,
`office-3d-pos-missao.png`, `office-3d-mobile.png`.
