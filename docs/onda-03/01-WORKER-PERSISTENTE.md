# Onda 03 — Worker Persistente (FASE 02)

## Mudanças
- **`packages/commercial/src/orchestrator.ts`**: `emit()` agora chama
  `store.persistEvent` quando disponível — eventos do fluxo persistem no
  `EventOutbox` independentemente de quem disparou (API, worker, teste).
- **`runDemoFlow(store, queue, { correlationId })`**: aceita correlationId
  externo; persiste Lead/Mission/Task/Run/Step/Approval/Draft/auditoria via
  StorePort. Idempotência de domínio: worker checa `listMissions` por
  correlationId antes de enfileirar/processar — jobId sozinho não basta.
- **`apps/worker/src/index.ts`**: `resolveStoreFromEnv()` — `DATABASE_URL`
  presente → `PrismaStore` (mesmo banco/socket PGlite da API);
  `BGO_EMBEDDED_PGLITE=1` + sem URL → sobe PGlite efêmero + `db push`;
  nenhum → memória (modo dev, documentado). Semântica **at-least-once**
  preservada e documentada.
- **Handlers registrados** para `demo-flow` (persiste) e `noop` (testes).
- **Graceful shutdown**: SIGINT/SIGTERM fecham fila e desconectam Prisma.

## Consistência job ↔ banco
- Job BullMQ carrega `correlationId`/`missionId`; o handler reexecuta o
  fluxo de domínio com dedup por missão — reentrega não duplica efeitos
  (lead/missão/task verificados por correlationId).
- Estado do job (waiting/active/completed/failed) e registros de domínio
  são camadas separadas: domínio deduplica, fila garante entrega ≥1.

## Limitações honestas
- Stalled-job em execução e cancelamento de job *ativo* (não apenas
  pendente) seguem **não verificados** — BullMQ só expõe stalledInterval;
  cancelamento ativo exigiria checkpoint cooperativo no handler.
- `EventOutbox` é append-only; não há publisher assíncrono separado —
  persistência é síncrona no emit (suficiente para o volume atual).
