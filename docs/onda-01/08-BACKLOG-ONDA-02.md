# Onda 01 — Backlog Onda 02

1. **Redis real + BullMQ**: provisionar Redis isolado (Docker quando disponível ou binário Windows estável) em 127.0.0.1:6387; migrar `LocalQueue`→BullMQ mantendo idempotência/retry/DLQ/pausa; persistir jobs.
2. **Postgres real**: quando Docker existir, subir compose `bgo_*` e trocar PGlite por postgres:17; validar `migrate deploy` com a migration versionada.
3. **RBAC fino**: papéis operator/auditor com permissões por rota; UI de gestão de usuários.
4. **Captação**: origem por URL/referrer, UTM, consentimento granular por canal, endpoint de exclusão LGPD (`suppressedAt` já existe no schema).
5. **Orquestração persistente**: missions/tasks dirigidas por eventos do outbox; worker processando jobs do banco.
6. **Claims comerciais**: continuar bloqueadas até validação; fluxo de aprovação de claim pelo owner.
7. **Playwright CI**: suite no pipeline; mais estados (erro API, loading, sessões expiradas).
8. **Escritório 3D**: contratos de eventos → representação visual (Onda 05).
9. **Hardening**: CSRF para cookie auth, security headers, audit de login falho com IP, retenção de dados.
