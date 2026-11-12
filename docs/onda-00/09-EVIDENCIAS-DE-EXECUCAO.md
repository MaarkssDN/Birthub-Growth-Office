# BGO · Onda 00 — Evidências de Execução

Data da execução: 2026-11-12 · Executor: Devin (SWE-2) · Workspace: `C:\Github\Birthub-Growth-Office`

## 1. Ambiente verificado (FASE A)

```
node -v            → v22.23.5
pnpm (corepack)    → 12.18.0  (corepack enable; pnpm não estava no PATH)
docker --version   → NÃO INSTALADO → modo mock integral (bloqueio documentado)
git --version      → 2.56.0.windows.4
Workspace          → C:\Github\Birthub-Growth-Office (vazio, apenas .git)
```

## 2. Comandos executados e resultados reais

| Comando | Resultado |
|---------|-----------|
| `pnpm install` | ✅ 259 pacotes, lockfile gerado; `allowBuilds: esbuild` exigido pelo pnpm 12 (strictDepBuilds) |
| `pnpm -r run typecheck` | ✅ 8/8 projetos, 0 erros (TS strict + exactOptionalPropertyTypes) |
| `pnpm lint` | ✅ 0 erros (warnings zerados após limpeza) |
| `pnpm test` (vitest run) | ✅ **9 arquivos, 50 testes, 50 passed** em ~1.9s |
| `pnpm build` | ✅ contracts (declarações), api/worker (esbuild bundle), web (vite build 159 kB js / 4.5 kB css) |
| `pnpm dev:api` + curl | ✅ `GET /api/health` → `{mode:"mock", simulated:true}`; `POST /api/demo/run` → fluxo completo; approval decide → missão `completed` |
| `pnpm dev:web` + curl | ✅ `:4180` serve SPA; proxy `/api` → `:4181` responde |

### Saída resumida dos testes

```
✓ tests/isolation/isolation.test.ts  (5)
✓ tests/unit/events.test.ts          (6)
✓ tests/policies/policy.test.ts      (10)
✓ tests/unit/catalog.test.ts         (6)
✓ tests/unit/offer-claims.test.ts    (3)
✓ tests/unit/lead-machine.test.ts    (5)
✓ tests/unit/queue.test.ts           (3)
✓ tests/e2e-mock/flow.test.ts        (6)
✓ tests/api/api.test.ts              (6)
Test Files 9 passed (9) · Tests 50 passed (50)
```

### Fluxo sintético real (via API em execução)

- `POST /api/demo/run` → `correlationId d859606f…`, lead `qualified`, missão `awaiting_approval`.
- Eventos observados: `lead.created.v1`, `mission.created.v1`, 5× `mission.assigned.v1`,
  `run.started/step.completed/completed` por scout, meridian, beacon (parcial), pledge,
  **`run.failed.v1` beacon** (channel.send negado pela policy — evidência G04 em fluxo real),
  `lead.qualified.v1`, `draft.created.v1`, `approval.requested.v1`, `audit.denied.v1`.
- Auditoria: `agent:beacon channel.send.send_email denied`.
- `POST /api/approvals/:id/decision` (role approver) → `missionStatus: completed`; nada enviado.

## 3. Árvore de arquivos criados

```
Birthub-Growth-Office/
├── apps/
│   ├── api/            Fastify :4181 — REST, auth dev, SSE, policy probe, demo flow
│   ├── web/            React+Vite :4180 — dashboard, leads, missões, aprovações,
│   │                   catálogo 29, timeline, escritório placeholder 2D
│   └── worker/         fila local (idempotência/backoff/DLQ/pausa) + runner mock
├── packages/
│   ├── agents/         catálogo-29.json (cópia fiel), registry, POLICY_MATRIX v1
│   ├── commercial/     offer claims v1, ICP hipótese, rubrica v1, lead machine,
│   │                   store in-memory, orchestrador do fluxo demo
│   ├── contracts/      enums, envelope de eventos v1, schemas de domínio, redactPII
│   ├── observability/  EventBus, audit append-only, métricas
│   └── ui/             tokens (paleta oficial) + deriveVisualState
├── prisma/schema.prisma      modelo-alvo completo — NÃO MIGRADO (sem Docker)
├── infra/compose/            postgres:17 + redis:7, bgo_*, bind 127.0.0.1
├── assets/characters/manifest.json   specs dos 29 bonequinhos futuros (PLANEJADO)
├── docs/onda-00/              10 documentos oficiais
├── references/onda-00/        pacote-fonte (documento mestre, catálogo, gates, prompt)
├── tests/                     unit(4) policies(1) api(1) e2e-mock(1) isolation(1)
├── .env.example  .gitignore  eslint.config.js  vitest.config.ts
├── pnpm-workspace.yaml  package.json  README.md  AGENTS.md
└── pnpm-lock.yaml
```

## 4. Matriz de gates

| Gate | Estado | Evidência |
|------|--------|-----------|
| G00 verdade comercial | **APROVADO** | offer-v1: só `claim-name` approved; preço/features/SLA `pending`; ICP marcado `hypothesis:true`; teste `offer-claims` prova bloqueio de claims pendentes em drafts |
| G01 isolamento | **APROVADO** | tests/isolation (5 testes): sem refs ao repo antigo, sem Docker inseguro, compose `bgo_*`/127.0.0.1, env sem segredos; workspace `birthub-growth` |
| G02 reprodutibilidade | **APROVADO** | install/lint/typecheck/test/build executados e verdes nesta máquina; comandos documentados |
| G03 catálogo | **APROVADO** | 29 IDs únicos, 9+15+4+1, exatamente 6 ativos (`aegis relay scout meridian beacon pledge`), pilares sem runtime |
| G04 políticas | **APROVADO** | 10 testes negativos: channel.send negado mesmo com aprovação+opt-in (W00), payment/contract/mass_send L4, self-approval, cross-tenant, agente inativo; negação real observada no fluxo (`run.failed.v1` + audit denied) |
| G05 fluxo interno | **APROVADO** | E2E mock: lead sintético → aprovação pendente → decisão → completed; flag `simulated:true` em tudo; zero envio externo |
| G06 auditoria | **APROVADO** | eventos versionados com eventId/correlationId/occurredAt; audit append-only com outcome allowed/denied; redactPII testado |
| G07 UI | **APROVADO** | build vite ok; dev server serve SPA; selo SIMULAÇÃO, badges awaitingApproval/simulated, 8 abas responsivas, reduced-motion no CSS; smoke via curl (renderização visual não auditada por screenshot) |
| G08 segurança | **APROVADO COM RESSALVA** | sem segredos, binds 127.0.0.1, PII sintética, LGPD documentada; **ressalva:** Docker indisponível → Postgres/Redis não executados (compose pronto); auth é dev-header, não real |
| G09 relatório | **APROVADO** | este documento + docs 00–08 + commits locais |

## 5. Limitações e divergências honestas

- **Persistência volátil**: store in-memory; reinício da API zera dados. Prisma
  schema e compose entregues; promoção exige Docker/Podman seguro.
- **BullMQ não executado**: `LocalQueue` reproduz semântica exigida; migração
  futura documentada (Job Schedulers, não `repeat`).
- **Auth de desenvolvimento**: headers `x-bgo-user`/`x-bgo-role`; sem senha real.
  Onda 01 deve implementar auth local de verdade.
- **UI sem screenshot**: verificação visual limitada a build+smoke HTTP;
  recomendo abrir `pnpm dev:web` para inspeção manual.
- **Rubrica v1** é heurística documentada (evidência por componente, lacunas
  explícitas); não é modelo preditivo.
- `pnpm.onlyBuiltDependencies` foi substituído por `allowBuilds` (pnpm 12).

## 6. Handoffs para Onda 01

1. Subir `infra/compose` quando Docker seguro existir → `PrismaPersistenceAdapter`.
2. Auth local real (hash de senha, sessão) substituindo headers dev.
3. Formulário de captura próprio + deduplicação de leads.
4. ProviderPort real de IA somente após orçamento aprovado.
5. Homologação de arte dos 29 personagens antes da Onda 05.
