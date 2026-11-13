# Onda 06 — Custos e Consumo (G55)

- `AiGateway` já enforce `maxCallsPerRun`, `maxTokensPerCall`,
  `maxCostUnitsPerRun` (costUnits = ⌈(tokensIn+tokensOut)/1000⌉).
- `AiStatus.usage` agora expõe `callsThisRun`/`costUnitsThisRun` em
  `GET /api/ai/status` — transparência por run.
- Auditoria registra provider/model/promptVersion por diagnóstico.
- Em modo simulated, MockProvider retorna tokens 0 → custo 0 (honesto).

Pendência: persistir série histórica de custo por missão (backlog).
