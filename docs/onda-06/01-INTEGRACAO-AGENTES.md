# Onda 06 — Integração dos Agentes

Contratos por agente (entrada/saída/ferramentas/permissões) já existem em
`packages/agents` (catálogo 29 + 6 ativos) e `POLICY_MATRIX`. Nesta onda:

- **AEGIS**: `mission.plan` L2 — cria/coordena missões (runDemoFlow).
- **RELAY**: `task.dispatch` L2 + `task.*`/`mission.*` genéricos L2.
- **SCOUT**: `research.web` L1 — fontes autorizadas; `research.scrape_restricted` L4 bloqueado.
- **MERIDIAN**: `lead.score` L2 + `meridian.diagnose.v1` via AI Gateway.
- **BEACON**: `draft.create` L2; `draft.send_external`/`channel.send` L3→negado W00.
- **PLEDGE**: `task.reminder` L2; `calendar.confirm`/`followup.send_external` L3→negado.

Nenhum agente inventa claims: `claimApproved` obrigatório e OfferClaim
`approved` pré-requisito (guarda anti-promessas no Meridian).
