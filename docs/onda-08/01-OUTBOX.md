# Outbox — reconciliação de legados (G81)
`baselineMode` em OutboxPublisher:
- "mark" (default): marca occurredAt<cutoff sem reemitir — occurredAt NÃO
  comprova entrega; documentado como decisão explícita, métrica baseline.
- "deliver"/"skip": preserva pendentes — drain os emite (replay único).
Novos testes provam que legados NÃO são descartados nos modos deliver/skip.
Semântica at-least-once mantida; dedup por eventId no consumidor.
