# Onda 06 — Diagnóstico Inicial

Branch `feat/onda-06` de `main` @6fffd8b. Baseline herdada: 73 testes,
6 GLBs animados, PG17+Memurai nativos, BullMQ, outbox persistente.

## Integrações auditadas
- IA: `packages/ai` gateway + `meridian.diagnose.v1` + `POST /api/ai/meridian-diagnose`.
  Modo simulated (sem credencial) — G33/G51 bloqueado honestamente.
- Orquestração: `runDemoFlow` cobre jornada lead→missão→diagnóstico→rascunho→aprovação.
- Outbox: `persistEvent` gravava sem `publishedAt`; SSE usava só eventBus em memória.
- RBAC: `POLICY_MATRIX` agent×tool×action já existia; faltavam testes negativos granulares.
- Web: bundle único ~1,1MB com three.js — office não era code-split.
