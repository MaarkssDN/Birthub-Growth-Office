# Onda 03 — Plano: Ativação de IA e Escritório Visual

## Objetivo
Ativar provedores de IA reais de forma controlada e iniciar o escritório 3D consumindo eventos reais.

## Pré-requisitos bloqueantes
1. **G21**: PostgreSQL nativo (Docker ou instância autorizada) — sem ele, PGlite segue dev-only.
2. **G22-hardening**: Redis com AOF/RDB via `BGO_REDIS_URL`; teste de crash durante handler; cancel() coberto por teste.
3. **Segurança**: rotação de credenciais seed; `secure` cookie quando HTTPS; auditoria de ações de fila.
4. **Worker persistente**: integrar worker a `PrismaStore` (hoje usa `Store` memória) para que jobs demo-flow escrevam no mesmo banco da API.

## Ativação de IA (Fase 05 → real)
- `packages/ai` já expõe: adapters, budgets (tokens/custo/chamadas), timeouts, model registry, prompt versions, modo simulated.
- Checklist de ativação: definir provider real via env → smoke test de 1 chamada → registrar modelo → versionar prompt → **manter `channel.send` e ações externas bloqueadas** → aprovação humana obrigatória para qualquer ação externa.
- Métrica de sucesso: agentes produzem saída marcada `provider=real, model=X, promptVersion=Y` — nunca confundir com simulated.

## Escritório visual (Fase 06 → UI 3D)
- Consumir `VISUAL_STATES` (idle/listening/processing/speaking/success/error) + `correlationId` dos eventos reais.
- 29 retratos existentes preservados; estados derivados de eventos reais apenas — **proibido simular execuções inexistentes**.
- Pipeline: eventBus → projeção de estado por agente → renderer 3D.

## Gates sugeridos Onda 03
G30 IA real controlada · G31 escritório 3D funcional · G32 worker↔DB persistente · G33 hardening Redis/PG nativo · G34 regressão total.
