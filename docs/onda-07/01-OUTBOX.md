# Outbox — correção e testes (G71)
`packages/commercial/src/outbox-publisher.ts`: OutboxPublisher extraído da API.
- baseline(): marca occurredAt < cutoff sem reemitir (histórico já entregue ao vivo)
- drainOnce(): emit→mark; falha no emit = retry backoff exponencial (1s→60s, max 8)
  sem marcar; falha no mark após emit = reentrega (at-least-once)
- métricas: published/retried/failed/pending → incr outbox.* no /api/metrics
- stop(): batida final controlada; start() só roda se store persistente
Testes: tests/unit/outbox-publisher.test.ts — 5/5 (baseline, backoff,
falha mark→reentrega, métricas, shutdown).
