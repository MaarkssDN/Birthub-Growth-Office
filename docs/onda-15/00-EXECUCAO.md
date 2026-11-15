# Onda 15 (incremento) — Portal público + tarefas supervisionadas dos 5 agentes

## Entregue
1. Portal público + CaptureModal (commit anterior neste branch — trabalho
   iniciado na sessão anterior da Onda 14/15, validado e commitado).
2. `packages/ai/src/agents.ts` — agentTask() para scout/beacon/relay/pledge/aegis:
   sanitizeForAi (remove PII), prompts versionados existentes, validação de
   schema JSON por agente, guarda anti-promoções (mesma regex do Meridian),
   provider/model/promptVersion/simulated auditáveis.
3. `POST /api/ai/agent-task` — auth, rate limit 20/h, assertBudget (429),
   auditoria ai.agent_task, usageSink → CostLedger por missão.
4. Testes: 4 unitários + 1 API — simulated=true honesto, guarda de claims,
   sanitize, 400 agentId inválido, 401 sem auth.

## Não entregue / backlog
- UI dedicada p/ disparar tarefas por agente (API pronta).
- Prompts específicos por agente ainda são os genéricos do registry v1.
- Embeddings locais, benchmark multi-provider, métricas de host (backlog Onda 15).
