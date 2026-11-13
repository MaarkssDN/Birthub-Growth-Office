# Custos de IA (G95/G96/G117/G118)
- AiGateway.usageSink → CostLedger.record por chamada (fire-and-forget).
- AiUsageRecord persiste: missionId, agentId, provider, model, promptKey/version,
  tokens in/out, costUnits, estimatedCost, billedCost, tariffVersion, durationMs,
  status, correlationId, occurredAt, simulated.
- estimatedCost só com AiTariff ativa (versionada); billedCost sempre null hoje
  (provedor não reporta) — NUNCA apresentado como faturado.
- simulated=true não gera estimativa nem consome orçamento real.
- Orçamento: limites por env BGO_BUDGET_DAILY_UNITS / BGO_BUDGET_MONTHLY_UNITS
  (costUnits); execução já limitada por maxCostUnitsPerRun no gateway.
- Enforcement: assertBudget() pré-inferência (rota meridian-diagnose → 429)
  + insertUsageGuarded() atômico — PG: advisory lock + somas na mesma tx;
  memory: fila serializada. Excedente vira registro status="blocked", costUnits=0.
- API: GET /api/costs (usage+budget+disclaimers), GET/POST /api/costs/tariffs
  (tarifas só owner — operador cadastra preços reais, nada inventado).
- UI: aba "Custos IA" com totais dia/mês, histórico e tarifas.
