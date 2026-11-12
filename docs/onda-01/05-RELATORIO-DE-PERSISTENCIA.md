# Onda 01 — Relatório de Persistência

## Arquitetura
- `StorePort` (assíncrono) em `packages/commercial/src/store-port.ts` — 30+ métodos.
- `Store` (memória) — dev/testes, `BGO_PERSISTENCE=memory`.
- `PrismaStore` (`packages/db/src/store.ts`) — PostgreSQL real via Prisma 6.19.

## Motor de banco: PGlite (decisão documentada)
- Docker ausente; Postgres nativo recusa rodar como admin; `embedded-postgres` falhou (mesmo motivo).
- **PGlite 0.3.7** = PostgreSQL real compilado em WASM, persistência em disco.
- Socket TCP via `@electric-sql/pglite-socket` em `127.0.0.1:5437`.
- Dados em `<repo>/var/pglite` — sobrevivem a restart de processo/máquina.
- `connection_limit=1` obrigatório (PGlite = sessão única; prepared statements nomeados colidiriam com pool>1).
- `sslmode=disable` obrigatório (PGlite não faz SSL).

## Identidade do banco
- `current_database()` no socket sempre retorna o banco interno (PGlite ignora dbname no startup).
- Garantias: dataDir exclusivo + porta localhost + `_bgo_instance.slug='birthub-growth'` verificado em `init()`.
- DATABASE_URL usa o nome mandatório `birthub_growth_office_dev` (efetivo se migrado p/ Postgres real).

## Schema
- 18 modelos Prisma; `consent` tornado opcional; campos Onda 01 (company/interest/privacy/dedupKey/sessions).
- Migration SQL versionada em `prisma/migrations/20250101000000_init_onda01/` (db push aplicado; `migrate dev` indisponível sem shadow DB).

## Eventos
- `EventOutbox` persiste cada evento do EventBus via `persistEvent` → `/api/events` lê do banco quando persistente.
- `AuditEvent` append-only em tabela própria.

## O que NÃO é persistente ainda
- `LocalQueue` do worker (jobs em memória) — BullMQ bloqueado por ausência de Redis.
- Sessões persistem, mas rate-limit counters são por processo.
