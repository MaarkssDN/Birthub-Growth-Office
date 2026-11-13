# Onda 03 — Matriz de Gates (G30–G41)

| Gate | Status | Evidência |
|---|---|---|
| G30 Preservação | ✅ | 63→71 testes, 0 regressões; Ondas 00–02 intactas |
| G31 Worker persistente | ✅ | `resolveStoreFromEnv` → PrismaStore; teste E2E outbox |
| G32 Recuperação | ✅ | restart worker ✅, cancel pendente ✅, idempotência ✅, **stalled em execução ✅, cancel ativo cooperativo ✅** (Onda 04) |
| G33 IA real | ⚠️ PARCIAL | contrato OpenAI-compatible validado via stub; **sem credenciais reais** — ativação pendente |
| G34 Escritório 3D | ✅ | cena iso navegável, WebGL + fallback |
| G35 Personagens | ⚠️ PARCIAL | 6 bonequinhos procedurais individualizados; **protótipos, não assets finais** |
| G36 Eventos→animações | ✅ | SSE real → estados; provado em Playwright |
| G37 Segurança | ✅ | auth, RBAC, rate limit, aprovações, `channel.send` negado, auditoria |
| G38 Interface | ✅ | pw-office 8/8 + regressão 11/11, desktop+mobile |
| G39 Qualidade | ✅ | lint 0, typecheck 10/10, **71/71 testes**, build OK |
| G40 Independência | ✅ | zero deps do Birthub 360° |
| G41 Infra | ⛔ PARCIAL | Docker ausente; **PostgreSQL nativo BLOQUEADO**; Redis embed volátil; PGlite dev OK |

**Veredito:** frente visual (G34–G38) homologada; frente operacional
parcial por ambiente (G32 parcial, G33 sem credencial, G41 bloqueado).
**Não declarar integralmente aprovada** — ressalvas obrigatórias mantidas.
