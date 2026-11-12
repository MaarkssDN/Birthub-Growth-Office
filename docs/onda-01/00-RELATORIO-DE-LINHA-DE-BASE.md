# Onda 01 — Fase 01: Relatório de Linha de Base

## Baseline (reexecutado antes de qualquer mudança)
- `pnpm install` OK · `pnpm lint` 0 erros · `pnpm -r typecheck` 8/8 · `pnpm test` 50/50 · `pnpm build` OK.
- Git: 4 commits Onda 00 (`c012629`, `bc71eed`, `f288979`, `0baba53`), worktree limpo no início.
- 89 arquivos versionados + pacote-fonte preservado em `references/onda-00/`.

## Adapters em memória identificados (pontos de substituição)
| Adapter | Arquivo | Substituição Onda 01 |
|---|---|---|
| Store (leads/missões/runs/drafts/approvals/audit) | `packages/commercial/src/store.ts` | `StorePort` assíncrono + `PrismaStore` (`packages/db`) |
| EventBus (histórico SSE) | `packages/observability/src/bus.ts` | mantido p/ SSE + `EventOutbox` persistido via `PrismaStore.persistEvent` |
| Audit log | `packages/observability/src/audit.ts` + store | `AuditEvent` table via `appendAudit` |
| Auth dev-header | `apps/api/src/app.ts` | sessões reais (AuthSession) + scrypt; dev-header gated por `BGO_DEV_AUTH=1` |
| LocalQueue | `apps/worker/src/queue.ts` | mantida — BullMQ **bloqueado** (sem Redis real) |

## Invariantes preservados
- Catálogo 29 personas, 6 agentes ativos, `POLICY_MATRIX` intactos (testes G03/G04 verdes).
- Claims comerciais: só `claim-name` aprovado; resto `PENDENTE_DE_VALIDACAO`.
