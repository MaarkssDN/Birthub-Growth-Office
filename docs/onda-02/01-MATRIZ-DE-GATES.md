# Onda 02 — Matriz de Gates (G20–G29)

| Gate | Estado | Evidência |
|------|--------|-----------|
| G20 Preservação | ✅ APROVADO | 29 IDs, 6 agentes, POLICY_MATRIX intactos; 63 testes (58 anteriores + 5 novos); zero remoção de features homologadas. |
| G21 PostgreSQL nativo | ⛔ BLOQUEADO | Sem Docker; Postgres nativo indisponível no ambiente; `embedded-postgres` recusa admin. PGlite (Postgres real em WASM, disco) segue ativo — **não** equivale a nativo. |
| G22 BullMQ | ✅ APROVADO (escopo worker-failure) | 5 testes: processamento, idempotência, DLQ após retries, **job pendente sobrevive a restart do worker e é retomado**, pausa/retomada. Redis real via redis-memory-server. Ressalva: durabilidade do Redis em si depende de AOF/RDB em produção. |
| G23 Segurança | ✅ APROVADO | Revisão Onda 01 confirmada; sem segredos em commits; `BGO_DEV_AUTH` gated; binds 127.0.0.1; rate limit ativo; auditoria preservada. Detalhes em `05-RELATORIO-SEGURANCA.md`. |
| G24 Agentes | ✅ APROVADO | Fluxo dos 6 agentes re-executado via Playwright sobre stack persistente (PGlite) — 11/11 checks. |
| G25 Integridade | ✅ APROVADO | Auditoria append-only e aprovações humanas funcionando; `channel.send` segue negado. |
| G26 Qualidade | ✅ APROVADO | lint 0 erros · typecheck 10/10 · **63/63 testes** · build OK. |
| G27 Interface | ✅ APROVADO | Playwright desktop 1440×900 + mobile 390×844 — 11/11 + screenshots em `evidencias/`. |
| G28 Independência | ✅ APROVADO | Nenhuma dependência do Birthub 360°; testes de isolamento verdes. |
| G29 Governança | ✅ APROVADO | Este diretório + commits atômicos + parecer do supervisor. |

**Resumo: 8 aprovados, 1 bloqueado (G21), 0 fraudes de evidência.**
