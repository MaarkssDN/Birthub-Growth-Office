# Onda 02 — Inventário de Alterações e Commits

## Arquivos criados
- `packages/ai/` — package.json, tsconfig, src/index.ts (~256 linhas): provider abstraction, simulated provider, OpenAI-compat adapter, budgets/timeouts, prompt versions, aiGateway.
- `apps/worker/src/persistent-queue.ts` — PersistentQueue BullMQ.
- `tests/queue/bullmq.test.ts` — 5 testes de fila persistente.
- `docs/onda-02/00..08` + `evidencias/*.png`.

## Arquivos modificados
- `apps/worker/src/index.ts` — backend selection local|bullmq, resolveRedisUrl, async createWorker, handlers demo-flow/noop.
- `apps/worker/package.json` — +bullmq 5.58.0, ioredis 5.6.1, redis-memory-server 0.17.2.
- `apps/api/src/app.ts` — `GET /api/ai/status`.
- `packages/contracts/src/enums.ts` — `VISUAL_STATES` + `VisualState` (idle/listening/processing/speaking/success/error).
- `.env.example` — BGO_AI_*, BGO_REDIS_URL/EMBEDDED documentados.
- `pnpm-workspace.yaml` — allowBuilds p/ redis-memory-server, msgpackr-extract.
- `package.json` (root) — devDep redis-memory-server p/ testes.
- `pnpm-lock.yaml` — deps.

## Commits (a criar nesta onda — atômicos)
1. `feat(onda-02): packages/ai provider architecture + visual state contract`
2. `feat(onda-02): BullMQ persistent queue + recovery tests`
3. `docs(onda-02): relatórios, gates G20-G29, evidências`

## Não alterado (preservação)
- 29 personagens, POLICY_MATRIX, 6 agentes, fluxo comercial, auth Onda 01, Prisma schema/migration, UI 8 abas.
