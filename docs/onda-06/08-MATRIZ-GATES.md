# Onda 06 — Matriz de Gates

| Gate | Status | Evidência |
|---|---|---|
| G50 Preservação | ✅ | 0 regressões, 79/79 testes, Playwright verde |
| G51 IA Real | ⛔ BLOQUEADO POR CREDENCIAL | gateway pronto, sem key autorizada |
| G52 Orquestração | ✅ | jornada completa sintética + correlationId |
| G53 Outbox | ✅ | publisher assíncrono + publishedAt + baseline |
| G54 RBAC | ✅ | POLICY_MATRIX + 6 testes negativos granulares |
| G55 Custos | ✅ | limites enforce + usage em /api/ai/status |
| G56 Captação | ✅ | proveniência+dedup+validação (Onda 01, mantido) |
| G57 Escritório | ✅ | estados via SSE real, GLBs animados intactos |
| G58 Segurança | ✅ | channel.send L3 negado W00; sem envios externos |
| G59 Qualidade | ✅ | lint/typecheck/testes/build/Playwright |
| G60 Independência | ✅ | isolation test verde |

Veredito: Onda 06 aprovada com G51 honestamente bloqueado por credencial.
