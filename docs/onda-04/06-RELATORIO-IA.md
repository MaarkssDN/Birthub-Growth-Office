# Onda 04 — Relatório de Integração de IA (G33)

## Estado: **BLOQUEADO POR CREDENCIAL** — implementação pronta e testada

## O que existe (Onda 03, mantido)
- `POST /api/ai/meridian-diagnose` — auth + rate limit 10/h + auditoria.
- `packages/ai/src/meridian.ts` — diagnóstico estruturado
  (verdict/confidence/reasonCodes/gaps/recommendedAction).
- `sanitizeLeadForAi` — PII removida antes do modelo.
- `parseDiagnosis` — schema estrito, rejeita saída fora do contrato.
- **Guarda anti-promessas**: rejeita `R$`, `%`, "garantia", "SLA",
  cases não aprovados na `KnowledgeApprovedClaim`.
- Modo `simulated` padrão; real exige `BGO_AI_MODE=real` +
  `BGO_AI_ENABLED=1` + `BGO_AI_API_KEY` (somente backend, `.env` gitignored).
- Contrato OpenAI-compatible provado via stub local (6/6 testes AI).

## Verificação nesta sessão
`GET /api/ai/status` → `{"mode":"simulated","realCallsEnabled":false}`.
Nenhuma credencial autorizada foi fornecida → **G33 permanece BLOQUEADO**.

## Como ativar (quando houver credencial)
1. Adicionar `BGO_AI_API_KEY`, `BGO_AI_MODE=real`, `BGO_AI_ENABLED=1`
   ao `.env` (nunca commitar).
2. `POST /api/ai/meridian-diagnose` com `leadId` de lead sintético/autorizado.
3. Resultado auditável registra provider/model/promptVersion/correlationId.
4. Ações externas continuam bloqueadas — IA só diagnostica; humano aprova.

## Regras preservadas
- Chave nunca em prompt, log ou arquivo versionado.
- Limites de tokens/custo/chamadas/timeout ativos no gateway.
- Nenhum envio comercial externo por decisão de IA.
