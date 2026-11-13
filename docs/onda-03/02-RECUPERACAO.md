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

## Atualização Onda 04 (2026-11-13) — G32 agora VERIFICADO

- **Stalled em execução**: teste `recupera job stalled EM EXECUÇÃO` —
  handler trava, conexão Redis do worker é derrubada (lock expira), novo
  worker detecta o job stalled e reexecuta (at-least-once). ✅
- **Cancelamento de job ativo**: `cancel()` agora grava flag em
  `bgo:cancel-requests` (Redis); processor verifica antes de executar e
  handlers recebem `ctx.isCancelled()` para abortar cooperativamente.
  Job cancelado vai para DLQ (auditável). Teste dedicado ✅.
- Tuning exposto: `startWorker(concurrency, { stalledIntervalMs,
  lockDurationMs, maxStalledCount })`.

## Ainda NÃO VERIFICADO (registrado, não escondido)
- Redis **durável em produção**: AOF do Memurai verificado com restart do
  serviço (Onda 04), mas a suíte de testes usa redis-memory-server volátil.
- `job.remove()` em job ativo não é suportado pelo BullMQ — cancelamento
  de ativo é cooperativo: handlers que ignoram `ctx.isCancelled()` rodam
  até o fim (documentado; demo-flow pode ganhar checkpoints futuros).
