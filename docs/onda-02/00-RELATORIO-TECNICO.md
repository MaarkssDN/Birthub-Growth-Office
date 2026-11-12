# Onda 02 — Relatório Técnico da Implementação

## Escopo executado

| Fase | Resultado |
|------|-----------|
| 01 Verificação/preservação | Baseline re-executado: lint 0 erros, typecheck 10/10, 58→63 testes, build OK. 7 commits Onda 00/01 preservados, worktree auditável. |
| 02 PostgreSQL nativo | **BLOQUEADO** — sem Docker, sem Postgres nativo utilizável (embedded-postgres recusa execução como admin; nenhum serviço remoto autorizado). PGlite segue como modo dev documentado. G21 = NÃO VERIFICADO. |
| 03 Redis/BullMQ | **IMPLEMENTADO E TESTADO** — `PersistentQueue` (BullMQ 5.58 + ioredis 5.6) com idempotência, retry/backoff exponencial, DLQ `bgo-dlq`, pausa/retomada, cancelamento, concorrência, correlação. `redis-memory-server` provou Redis real em `127.0.0.1:6387`. 5 testes novos cobrem restart/recovery. |
| 04 Segurança | Revisão executada (ver `05-RELATORIO-SEGURANCA.md`). Sem credenciais em commits; `BGO_DEV_AUTH` gated; cookies httpOnly. |
| 05 Provedores de IA | **`packages/ai` criado** — adapters, env config, limites de tokens/custo/chamadas, timeout, registro de modelo, versionamento de prompt, modo simulated separado de real. **Nenhum agente usa IA real**; status exposto em `GET /api/ai/status`. |
| 06 Personagens | 29 IDs preservados; 6 agentes ativos intactos; contrato `VISUAL_STATES` (idle/listening/processing/speaking/success/error) adicionado em `@bgo/contracts`. Nenhum retrato novo. |
| 07 Homologação | Gates em `01-MATRIZ-DE-GATES.md`. |

## Arquitetura da fila persistente

`apps/worker/src/persistent-queue.ts`:
- Filas BullMQ `bgo-jobs` (principal) e `bgo-dlq` (dead-letter).
- `jobId = idempotencyKey` → deduplicação nativa; `processedKeys` em memória como segunda barreira.
- `attempts` + `backoff exponential 500ms` por job; handler `failed` move job esgotado para DLQ.
- `Worker` com `stalledInterval: 10s` → recuperação de jobs órfãos após crash do worker.
- `pause()/resume()/cancel()/counts()` expostos; `maxRetriesPerRequest: null` (requisito BullMQ).
- Entrega **at-least-once**: handlers devem ser idempotentes; efeitos externos seguem bloqueados por policy (`channel.send` negado).

`apps/worker/src/index.ts`: `resolveRedisUrl()` — `BGO_REDIS_URL` → Redis real; `BGO_REDIS_EMBEDDED=1` → redis-memory-server (dev, volátil); senão `LocalQueue` (legado, mantido para testes/mock).

## Limitações honestas

- `BGO_REDIS_EMBEDDED` usa Redis em memória: dados de fila **não** sobrevivem a restart do processo Redis — apenas a restart do *worker* (cenário testado). Para durabilidade total, `BGO_REDIS_URL` deve apontar para Redis com AOF/RDB.
- Worker standalone usa `Store` em memória (modo mock); integração worker↔PrismaStore fica para Onda 03 junto com ativação de IA.
- PostgreSQL nativo não executado neste ambiente.
