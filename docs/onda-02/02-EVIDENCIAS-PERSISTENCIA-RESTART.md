# Evidências de Persistência e Restart

## PostgreSQL (PGlite — modo dev)
- `GET /api/health` → `{"persistence":"postgres"}` com PGlite ativo em `127.0.0.1:5437`, dados em `var/pglite`.
- Prova de restart (Onda 01, re-verificada): novo processo lê leads/missões/aprovações/auditoria do disco.
- 18 modelos Prisma verificados via `prisma db push` + migration `20250101000000_init_onda01`.

## PostgreSQL nativo — BLOQUEADO
- Docker: indisponível. Postgres nativo/embedded: recusa execução como usuário admin do ambiente. Nenhum serviço remoto autorizado. **Nenhuma tentativa de bypass.**

## Fila BullMQ — restart do worker (NOVO, Onda 02)
Teste `tests/queue/bullmq.test.ts` com Redis real (`redis-memory-server`, `127.0.0.1:6390` nos testes / `6387` standalone):
1. Job enfileirado → processado → `completed` no Redis.
2. Mesma `idempotencyKey` → `deduplicated:true`, handler executa 1×.
3. Handler que lança erro → 2 tentativas com backoff → job movido para `bgo-dlq`.
4. **Restart**: producer enfileira; worker A fecha sem `startWorker`; worker B (novo processo/lógica) consome o job pendente do Redis → executa. Prova de que o job vive no Redis, não no worker.
5. `pause()` → job não executa; `resume()` → executa.

Comando: `pnpm test` → `tests/queue/bullmq.test.ts` 5/5 PASS (~4.2s).
