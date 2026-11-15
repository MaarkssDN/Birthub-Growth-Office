# Onda 16 — Execução (incremento 1: IA dentro do pipeline)

## Escopo entregue
- `runOpportunityMission` aceita `agentTaskHook` opcional (deps).
- Scout, Beacon e Pledge executam `agentTask` supervisionado durante o run;
  resultado gravado em `run.output.aiAssist` (provider, model, simulated,
  output truncado, parsed, rejectedReason).
- Pledge mescla `parsed.nextSteps` da IA aos passos determinísticos,
  prefixados `[IA SIMULADA]`/`[IA REAL]`.
- Falha/ausência do hook → pipeline segue 100% determinístico (try/catch → null).
- `app.ts` conecta o hook a `agentTask(aiGateway)` com `approvedClaims`.
- Custo: agentTask passa pelo usageSink → CostLedger (missionId/correlationId).

## Garantias preservadas
- aiAssist é informativo: não altera claims, estágios, aprovações ou envios.
- `simulated=true` propagado; nada exibido como real.
- Meridian continua via `diagnoseHook` (inalterado).
- Teste `tests/api/onda16.test.ts`: aiAssist presente nos 3 runs,
  simulated=true, fluxo awaiting_approval intacto.

## Pendente nesta onda
- Prompts dedicados por agente/mission-type (versionamento v2).
- aiAssist visível na UI do escritório (painel da missão).
- Métricas de host durante inferência.

## Incremento 2 — métricas de host na inferência
- `agentTask` retorna `host: { loadAvg1m, freeMemMb }` (snapshot os no fim da chamada).
- Propagado: rota `/api/ai/agent-task` (spread automático), `agentTaskHook` do pipeline
  e tipo em `runOpportunityMission` → visível em `run.output.aiAssist.host`.
- Base para o item "métricas de host durante inferência" do roadmap.
