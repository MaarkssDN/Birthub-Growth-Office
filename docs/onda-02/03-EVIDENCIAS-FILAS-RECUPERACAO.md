# Evidências de Filas e Recuperação (G22)

## Implementação
`apps/worker/src/persistent-queue.ts` — BullMQ `Queue`/`Worker`/`QueueEvents` sobre ioredis:
- Fila principal `bgo-jobs`; DLQ `bgo-dlq`.
- Idempotência por `jobId=idempotencyKey` + `getJob` pré-check + `processedKeys`.
- Retry: `attempts` por job (default 3) + `backoff exponential 500ms`.
- DLQ: hook `worker.on("failed")` move job quando `attemptsMade >= attempts`.
- Concorrência: `Worker(concurrency)` configurável (default 2 no entrypoint).
- Pausa/retomada: `queue.pause()/resume()` + `worker.pause()/resume()`.
- Cancelamento autorizado: `cancel(idempotencyKey)` remove job waiting.
- Correlação: `correlationId` propagado em `job.data` para observabilidade futura.
- Recuperação: `stalledInterval: 10s` → BullMQ reprocessa jobs de workers mortos.
- Semântica declarada: **at-least-once, nunca exactly-once**; handlers idempotentes; efeitos externos bloqueados.

## Seleção de backend
`resolveRedisUrl()` em `apps/worker/src/index.ts`:
1. `BGO_REDIS_URL` → Redis real (produção/dev sereno).
2. `BGO_REDIS_EMBEDDED=1` → `redis-memory-server` em `127.0.0.1:6387` (dev; **volátil** — reinicia com o processo).
3. fallback → `LocalQueue` legado (testes/mock; documentado como volátil).

## Cenários testados (reais, com Redis)
| Cenário | Resultado |
|---------|-----------|
| Enfileirar e processar | ✅ |
| Duplicata por idempotencyKey | ✅ 1 execução |
| Falha → retry → DLQ | ✅ 2/2 tentativas, job em `bgo-dlq` |
| Worker morre com job pendente → novo worker retoma | ✅ |
| Pausa / retomada | ✅ |
| Cancelamento | implementado (`cancel()`); não coberto por teste dedicado — **NÃO VERIFICADO em runtime** |

## Ressalvas
- `redis-memory-server` é Redis real mas **em memória**: sobrevive a restart do worker, não a restart do Redis. Produção exige Redis com persistência (AOF/RDB) via `BGO_REDIS_URL`.
- Stalled-job recovery de job *em execução* durante crash usa `stalledInterval` (10s em teste default do Worker); não testado com crash no meio do handler — apenas com job em `waiting`.
