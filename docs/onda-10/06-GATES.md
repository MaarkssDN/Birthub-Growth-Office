# Matriz de gates Onda 10
G110 ✅ zero regressões (102→115 testes, suite completa verde)
G111 ✅ persistência pós-restart comprovada no PG nativo (dados reais)
G112 ✅ dedup idempotente: reimportação inserted=0/dup=2 (memória+PG)
G113 ✅ proveniência: fonte, importadoEm, batchId, correlationId, history
G114 ✅ score com reasons/gaps/scoreVersion auditáveis
G115 ✅ Central Scout funcional c/ revisão humana (API testada + UI)
G116 ⚠️ empresas aprovadas → revisão humana existe; promoção p/ oportunidade
     comercial formal ainda não encadeada a missão (parcial)
G117 ✅ uso persistido por missão/agente/provider/model (API /api/costs)
G118 ✅ limites dia/mês c/ portão atômico (testes unitários + PG advisory lock)
G119 ✅ auth/RBAC, CSV 2MB, audit, export restrito, formula-injection guard
G120 ✅ escritório: painel Scout no agente + abas Scout/Custos (sem redesign)
G121 ✅ lint/typecheck/testes/build verdes (build precisou de heap maior — OOM ambiental)
G122 ✅ isolamento: teste isolation verde; zero refs ao Birthub 360°
BLOQUEADOS: inferência real (sem BGO_AI_API_KEY) — G85/G74 seguem abertos.
