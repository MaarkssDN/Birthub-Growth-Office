# Onda 04 — Backlog

1. **G21/G41**: provisionar PostgreSQL nativo + Redis durável (Docker ou
   instância autorizada) → backup, restore, AOF/RDB, teste de restart do
   Redis e dos 18 modelos.
2. **G32**: testes de stalled-job em execução (kill -9) e cancelamento
   cooperativo de job ativo.
3. **G33**: credencial autorizada → ativação real do `meridian.diagnose.v1`
   com avaliação de saída; estender para scout/beacon/pledge.
4. **G35**: substituir protótipos por modelos GLB finais aprovados
   (pipeline de arte: Blender → glTF → otimização → manifesto).
5. Outbox publisher assíncrono dedicado (hoje persistência é síncrona no emit).
6. Métricas de custo real de IA por missão (hoje só limites).
7. RBAC granular por agente no escritório (agente só age se autorizado).
