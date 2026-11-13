# Onda 06 — Outbox Assíncrono (G53)

Implementado em `apps/api/src/app.ts`:

- `PrismaStore.listUnpublishedEvents()` / `markEventPublished()` —
  leitura de `EventOutbox.publishedAt IS NULL`.
- **Baseline na subida**: eventos históricos (já entregues ao vivo antes
  desta feature) são marcados como publicados SEM reemitir — evita replay
  de todo o histórico no SSE a cada restart.
- **Drain a cada 5s**: eventos novos não publicados (ex.: escritos pelo
  worker enquanto a API estava fora) são reemitidos no `eventBus` (SSE)
  e marcados — entrega at-least-once, consumidores deduplicam por eventId.
- Falhas no drain são engolidas (próxima batida retenta) — publisher
  nunca derruba a API. `onClose` limpa o intervalo.

Testes: coberto indiretamente por persist.test.ts (outbox>5 eventos) +
smoke API; teste dedicado de drain fica como backlog G53+.
