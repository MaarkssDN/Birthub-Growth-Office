# Onda 06 — Inferência Real ou Bloqueio (G51)

**BLOQUEADO POR CREDENCIAL** — nenhuma `BGO_AI_API_KEY` autorizada fornecida.

Pronto para ativação: `BGO_AI_MODE=real` + `BGO_AI_ENABLED=1` + key no `.env`.
Gateway enforce: provider OpenAI-compatible, limites tokens/custo/chamadas,
timeout, prompts versionados, saída validada por schema, guarda anti-claims,
auditoria com provider/model/promptVersion/correlationId.
`GET /api/ai/status` agora expõe `usage.callsThisRun/costUnitsThisRun` (G55).
