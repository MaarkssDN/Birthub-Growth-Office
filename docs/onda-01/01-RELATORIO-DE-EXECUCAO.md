# Onda 01 — Relatório de Execução

## Implementado
- `StorePort` assíncrono (`packages/commercial/src/store-port.ts`) + `Store` in-memory reescrito.
- `packages/db`: PGlite socket server (127.0.0.1:5437, dados em `./var/pglite`), `PrismaStore` completo (18 modelos), tabela-marca `_bgo_instance`, seed idempotente de usuários/canais.
- Auth real: scrypt (N=16384), sessões opacas (sha256 em repouso), cookie httpOnly + Bearer, expiração 12h, revogação, RBAC (owner/approver decidem), rate limit login 5/5min e captação 10/h, `dev-header` só com `BGO_DEV_AUTH=1`.
- Captação pública `POST /api/capture`: validação zod, honeypot, dedup documentada (email hash / name+company), proveniência+privacidade LGPD v1, auditoria, sem mensagens automáticas.
- Orquestrador 100% assíncrono sobre StorePort; fluxo demo idêntico (6 agentes, denial de channel.send preservado).
- Web: tela de login, aba "Captação" pública, leads com colunas empresa/contato/tipo REAL vs SIMULAÇÃO.
- `prisma/schema.prisma` + migration SQL inicial em `prisma/migrations/`.

## Simulado (honesto)
- Runs/provedor `mock:true`; drafts `simulated:true`; selo "MODO SIMULAÇÃO" na UI.
- Fila do worker: `LocalQueue` em memória (idempotência/retry/DLQ/pausa) — **não** é BullMQ persistente.

## Bloqueado
- **Redis/BullMQ**: `redis-memory-server` não subiu no ambiente (download/execução do binário falhou/estourou tempo); Docker ausente; Postgres nativo recusa execução como admin. G10 parcial, G11 fila não comprovado.
- `migrate dev` indisponível via socket PGlite (sem shadow DB) → schema aplicado via `db push`; migration SQL versionada para Postgres real futura.

## Verificações executadas
- typecheck 10/10 pacotes · lint 0 problemas · testes 58/58 · build OK.
- API real: login scrypt OK, captação persiste, demo flow persiste, **restart da API manteve leads/missões/aprovações/auditoria** (G11).
- Playwright (Edge headless): 11/11 checks, 5 screenshots desktop 1440×900 e mobile 390×844.
