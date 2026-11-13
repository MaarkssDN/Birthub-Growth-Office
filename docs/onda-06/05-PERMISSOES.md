# Onda 06 — Matriz de Permissões (G54)

RBAC em duas camadas (inalteradas, agora com testes negativos):

1. **Role de usuário** (`owner|operator|approver|auditor`): aprovar decisão
   exige owner/approver (403 caso contrário) — app.ts:374.
2. **Policy engine por agente** (`POLICY_MATRIX`): agent×tool×action×risk×
   autonomy; L4 alwaysBlocked; external exige L3+contexto completo e é
   negado na W00.

Novo `tests/rbac/granular.test.ts` (6 testes): ferramenta própria permitida,
ferramenta exclusiva de outro agente negada, genéricas mission.*/task.*
permitidas, L4 bloqueado p/ todos, envios externos negados mesmo com
contexto completo, agente desconhecido negado.
