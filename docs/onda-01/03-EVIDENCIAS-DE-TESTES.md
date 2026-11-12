# Onda 01 — Evidências de Testes

## Comandos (saídas reais)
- `pnpm -r typecheck` → 10/10 pacotes Done.
- `pnpm lint` → 0 errors, 0 warnings.
- `pnpm test` → 9 arquivos, **58/58 testes** (era 50; +8: auth, sessões, rate limit, captação, dedup, honeypot, dev-header gate).
- `pnpm build` → todos os apps/pacotes OK.

## Persistência (prova de restart)
1. `tsx smoke-store.mts` (PROCESSO A): capture+dedup+demo flow → 2 leads, 1 missão completed, 17 audits.
2. `tsx smoke-read.mts` (PROCESSO B, novo): leu os mesmos dados do disco → **sobreviveu**.
3. API reiniciada (kill + start): `/api/missions` mostrou 2 missões, `/api/approvals` 1 pendente, leads intactos.

## API real (curl, porta 4181)
- `POST /api/auth/login` owner@bgo.local → token opaco (cookie+Bearer).
- `POST /api/capture` → 201 leadId; reenvio → 200 `duplicate:true` mesmo leadId.
- `POST /api/demo/run` → awaiting_approval; decisão aprova → completed.
- Sem token → 401 em rotas privadas; `x-bgo-*` ignorado com devAuth off.

## Playwright (scripts/pw-visual.mjs, Edge headless)
11/11 PASS: captação pública desktop+mobile, login, dashboard, demo run, aprovações, leads REAL/SIMULAÇÃO, 6 agent cards, sem overflow mobile.
Screenshots: `docs/onda-01/evidencias/*.png` (5 arquivos).
