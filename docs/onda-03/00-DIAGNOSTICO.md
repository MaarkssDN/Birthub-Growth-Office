# Onda 03 — Diagnóstico Inicial (FASE 01)

## Linha de base (10 commits, 2026-10-18)
- lint ✅ · typecheck ✅ · **63/63 testes** · build ✅ · Playwright 11/11
- Rotas relevantes para o escritório: `GET /api/events` (replay, auth) e
  `GET /api/events/stream` (SSE, auth) — já existentes desde a Onda 00.
- Catálogo de 29 personagens: `assets/characters/manifest.json` — **somente
  planejamento textual; nenhum asset 3D/GLB existe** (verificado no inventário
  de assets: zero arquivos de modelo). Bonequinhos do escritório são
  **protótipos procedurais**, não assets finais homologados.
- `PrismaStore.persistEvent`/`listPersistedEvents` existiam, mas **só a API
  chamava** `persistEvent` no publish — eventos emitidos pelo orquestrador
  (fluxo demo via API já passava pelo emit da API; via worker, perdiam-se).
  Corrigido nesta onda.

## Lacunas encontradas e tratadas
1. Worker standalone usava `new Store()` em memória mesmo com `DATABASE_URL`.
2. Orquestrador não persistia eventos no outbox quando chamado fora da API.
3. Sem case de uso de IA real supervisionado.
4. Escritório era placeholder 2D.
5. Sem testes de cancelamento de job ativo / stalled em execução.
