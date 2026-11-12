# Birthub Growth Office

Operação comercial independente **"Comercial Enlouquecidamente"** que venderá o
**Birthub 360°** por meio de agentes especializados — com autonomia
supervisionada, trilha auditável e, em ondas futuras, um escritório virtual 3D.

> **Onda 00 — Fundação.** Tudo nesta onda roda em **modo simulação**: nenhum
> e-mail, WhatsApp, convite, proposta ou cobrança real é enviado. A UI exibe o
> selo `SIMULAÇÃO` e os eventos carregam `simulated: true`.

## Stack

pnpm · TypeScript strict · React+Vite · Fastify · Zod · Vitest ·
PostgreSQL/Prisma + Redis/BullMQ **especificados** (Docker indisponível nesta
execução → persistência in-memory; ver `docs/onda-00/02`).

## Estrutura

```
apps/web        dashboard, leads, missões, aprovações, catálogo 29, timeline, office placeholder
apps/api        Fastify :4181 — REST, auth local, SSE, policy engine
apps/worker     runner de missões (mock) — BullMQ previsto p/ Onda 01
packages/contracts    schemas Zod, eventos, estados
packages/agents       catálogo 29, registry, policy matrix, 6 perfis ativos
packages/commercial   offer claims, ICP hipótese, rubrica, lead machine, aprovações
packages/observability outbox, audit trail, métricas mínimas
packages/ui           tokens de design e helpers de UI
prisma/         schema-alvo (não migrado)
infra/compose/  Postgres 17 + Redis exclusivos (bgo_*, 127.0.0.1)
assets/characters/  manifest de specs de arte (nenhum asset final)
docs/onda-00/   10 documentos oficiais da onda
references/onda-00/  pacote-fonte (documento mestre, catálogo, gates)
tests/          unit, policies, api, e2e-mock, isolation
```

## Quickstart

```bash
corepack enable            # se pnpm não estiver no PATH
pnpm install
pnpm dev:api               # http://127.0.0.1:4181  (modo mock)
pnpm dev:web               # http://127.0.0.1:4180
pnpm test                  # suíte completa
pnpm build
```

Login local (seed): `owner@bgo.local` / senha definida em `.env`
(ver `.env.example`).

## Fluxo demonstrativo (E2E mock)

`POST /api/demo/run` cria um lead sintético e executa:
criação → triagem Meridian → missão Aegis → dispatch Relay → dossiê Scout →
qualificação Meridian → rascunho Beacon → lembrete Pledge →
`ApprovalRequest` pendente → decisão humana → auditoria.

## Documentação

Comece por `docs/onda-00/00-ESCOPO-E-DECISOES.md` e
`docs/onda-00/09-EVIDENCIAS-DE-EXECUCAO.md` (gates G00–G09).
