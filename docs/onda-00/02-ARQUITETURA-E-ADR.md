# BGO · Onda 00 — Arquitetura e ADRs

## 1. Visão

```
OWNER / DIREÇÃO HUMANA (aprovações, oferta, política)
        │
   APP WEB (React+Vite :4180)  ──REST/SSE──▶  API (Fastify :4181)
        │                                          │
        │                                    Policy Engine (backend)
        │                                          │
        │                              Orquestrador de missões (mock)
        │                              Aegis → Relay → Scout/Meridian/
        │                              Beacon/Pledge (ExecutionRun/Step)
        │                                          │
        │                          EventOutbox → AuditEvent (append-only)
        │                                          │
        └──────── UI deriva de eventos ────────────┘
   WORKER (apps/worker): mesma lógica de run; BullMQ previsto p/ Onda 01+
```

Princípio: a UI 3D/2D **nunca** fala com modelos de IA; consome eventos
semânticos persistidos e `AgentVisualState` derivado de `ExecutionRun`.

## 2. ADR-001 — Monorepo pnpm + TypeScript estrito

- `pnpm-workspace.yaml` com `apps/*` e `packages/*`.
- TS `strict`, `noUncheckedIndexedAccess`, ESM, `moduleResolution: bundler`
  (apps) / `nodenext` conforme contexto. Versões fixadas em `packageManager`.
- Rejeitado: npm workspaces (resolução de peers mais fraca), Turborepo
  (overhead desnecessário nesta fase).

## 3. ADR-002 — Fastify + Zod

- Fastify 5 para HTTP; schemas Zod compartilhados em `@bgo/contracts`.
- SSE nativo (`reply.raw`) para stream de eventos; sem dependência extra.
- Rejeitado: Express (menor performance/características), NestJS (peso).

## 4. ADR-003 — Persistência: adapter pattern; Postgres+Prisma ADIADO

- Onda 00 entrega `PersistenceAdapter` com implementação **in-memory**
  (single-process, documentada como volátil).
- `prisma/schema.prisma` define o modelo-alvo completo (Workspace…AuditEvent).
- Docker indisponível no ambiente de execução → **nenhuma migration executada**;
  `infra/compose` pronto para Postgres 17 + Redis (bind 127.0.0.1, volumes `bgo_*`).
- Critério de promoção: quando `docker compose` seguro estiver disponível,
  implementar `PrismaPersistenceAdapter` e repetir a suíte de integração.

## 5. ADR-004 — Filas: semântica BullMQ em processo

- Sem Redis local, o worker usa fila in-process com as mesmas garantias
  exigidas: idempotency key, retry com backoff exponencial, limite de tentativas,
  DLQ lógica (`deadLettered` flag) e pausa global.
- Agendamentos futuros usarão **BullMQ Job Schedulers** (não `repeat` legado).
- Rejeitado: implementar BullMQ contra Redis inexistente (falso positivo).

## 6. ADR-005 — ProviderPort de IA

```ts
interface ProviderPort {
  analyze(input: unknown): Promise<ProviderResult>; // sempre mock em W00
}
```

`MockProvider` retorna saídas determinísticas marcadas `simulated: true`.
Nenhuma API key, nenhum custo. Substituição futura por provider real exige
ADR novo + orçamento aprovado.

## 7. ADR-006 — Fronteira com Birthub 360°

- Zero imports, zero rede, zero secrets compartilhados.
- Isolamento provado por: `tests/isolation` (varredura de strings proibidas),
  nomes `bgo_*`, portas 4180/4181/5437/6387 e workspace `birthub-growth`.
- Qualquer futura integração será por API documentada + contrato de eventos,
  nunca por build/deploy conjunto.

## 8. Segurança

- Policy engine no backend é a única autoridade de autonomia (L0–L4).
- RBAC mínimo: `owner`, `operator`, `approver`, `auditor` (seed local).
- PII: somente dados sintéticos; payloads de evento passam por `redactPII`.
- Bind `127.0.0.1` em tudo; nenhum serviço exposto à LAN.
