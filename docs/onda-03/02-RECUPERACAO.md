# Onda 03 — Recuperação e Consistência (G32)

## Verificado nesta onda (`tests/worker/persistent.test.ts`, Redis real :6391)
- **E2E persistente**: job `demo-flow` → `runDemoFlow` no `PrismaStore` →
  missão criada (`awaiting_approval`), >5 eventos no `EventOutbox`,
  auditoria gravada.
- **Idempotência de domínio**: segundo job com mesmo correlationId →
  handler retorna `skipped: true` sem duplicar missão.
- **Restart do worker**: novo `PersistentQueue` + worker sobre o mesmo
  Redis → job pendente é retomado e completado.
- **Cancelamento de job pendente**: `queue.cancel(jobId)` → job removido,
  handler nunca executa.

## Herdado da Onda 02 (ainda válido)
- DLQ após 5 tentativas com backoff exponencial.
- Pausa/retomada de fila.
- Semântica at-least-once documentada.

## NÃO VERIFICADO (registrado, não escondido)
- Cancelamento de job **ativo** durante execução.
- Recuperação de job **stalled** enquanto handler roda (kill -9 no meio).
- Redis **durável** (AOF/RDB): embed é volátil; `BGO_REDIS_URL` real não
  foi exercitado com restart do próprio Redis.
