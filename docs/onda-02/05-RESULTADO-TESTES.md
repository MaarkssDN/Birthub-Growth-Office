# Onda 02 — Resultado dos Testes Automatizados

## Comandos executados (saídas reais)

| Comando | Resultado |
|---------|-----------|
| `pnpm lint` | 0 erros, 0 warnings |
| `pnpm -r typecheck` | 10/10 pacotes OK |
| `pnpm test` | **63/63 testes**, 10 arquivos |
| `pnpm build` | OK (api + web) |
| `node scripts/pw-visual.mjs` | **11/11 PASS** (desktop + mobile checks) |
| `node scripts/pw-mobile.mjs` | concluído, screenshots salvos |

## Distribuição dos 63 testes
- 58 testes Onda 00/01 preservados (catálogo 29, políticas negativas, API, e2e mock, isolamento, lead-machine, queue local).
- **+5 novos** `tests/queue/bullmq.test.ts`: processamento, idempotência, DLQ, restart-recovery, pausa/retomada — com Redis real.

## Cobertura de infraestrutura real (não simulada)
- PGlite/PostgreSQL: persistência em disco verificada com processos novos.
- Redis/BullMQ: `redis-memory-server` = binário Redis real; jobs persistem no servidor Redis; worker pode morrer e outro retoma.
- Playwright: Edge headless real contra API+web compilados.

## Não verificado
- Cancelamento de job em runtime (`cancel()` implementado, sem teste dedicado).
- Crash do worker *durante* execução de handler (stalled recovery) — testado apenas job em `waiting`.
- PostgreSQL nativo — bloqueado por ambiente.
