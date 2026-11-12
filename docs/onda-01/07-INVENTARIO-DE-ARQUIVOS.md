# Onda 01 — Inventário de Arquivos Alterados/Criados

## Novos
- `packages/db/` (package.json, tsconfig, src/{client,pglite-server,store,index,pglite-cli}.ts, smoke*.mts)
- `packages/commercial/src/{store-port,auth,capture}.ts`
- `apps/web/src/views.tsx` · `scripts/pw-visual.mjs` · `scripts/pw-mobile.mjs`
- `prisma/migrations/20250101000000_init_onda01/migration.sql`
- `docs/onda-01/` (00–08 + evidencias/*.png)
- `var/pglite/` (dados locais, gitignored)

## Modificados
- `packages/contracts/src/domain.ts` — CaptureFormInput/Result, LoginInput, SessionInfo, PRIVACY_NOTICE_VERSION, campos Lead (company/interest/privacy/dedupKey), source `website_form`.
- `packages/commercial/src/{store,orchestrator,index,types}.ts` — StorePort async, auth scrypt, capture+dedup, orchestrator async.
- `apps/api/src/{app,index}.ts` — rotas auth/capture, preHandler auth, rate limit, devAuth flag, persistEvent hook, PrismaStore boot.
- `apps/web/src/{App,api}.tsx/ts` — login gate, aba Captação, Bearer token, colunas leads.
- `apps/api/package.json`, `apps/worker/package.json`, `packages/db/package.json` — deps (@bgo/db, @fastify/cookie, pglite, prisma).
- `prisma/schema.prisma` — consent Json?, models Onda 01.
- `pnpm-workspace.yaml` — allowBuilds p/ prisma/pglite/esbuild.
- `package.json` (raiz) — @prisma/client, prisma, tsx, playwright-core devDeps.
- `.env.example` — BGO_ADMIN_PASSWORD, BGO_DEV_AUTH, BGO_PERSISTENCE, DATABASE_URL.
- `.gitignore` — `var/`.
- `tests/{api,e2e-mock,unit}/` — async + 8 novos testes.

## Removidos (deps tentadas e revertidas — documentado)
- `embedded-postgres`, `bullmq`, `ioredis`, `redis-memory-server`.
