# Onda 01 — Matriz de Gates G10–G18

| Gate | Estado | Evidência |
|---|---|---|
| G10 Infraestrutura | ⚠️ PARCIAL | PostgreSQL real via **PGlite** (WASM, disco, 127.0.0.1:5437, dados em var/pglite) — funcional e isolado; **Redis/BullMQ BLOQUEADO** (sem binário/serviço); Docker ausente |
| G11 Persistência | ✅ (DB) / ❌ (fila) | leads/missões/runs/steps/approvals/drafts/audit/sessões/eventos sobrevivem restart de processo (provado 2×); **fila do worker volátil** |
| G12 Autenticação | ✅ | scrypt, sessão persistida+revogável, RBAC, rotas privadas 401, rate limit, dev-header gated, senha nunca em logs/repo |
| G13 Captação | ✅ | POST /api/capture + formulário UI; validação front/back; dedup documentada; proveniência+privacidade; honeypot+rate limit; lead entra no pipeline (status new) |
| G14 Agentes | ✅ | 6 agentes no fluxo persistido; POLICY_MATRIX intacta; channel.send negado em runtime; providers mock sinalizados |
| G15 Segurança | ✅ | 14 testes API (401, dev-header off, rate limit, dedup, honeypot); isolamento tests verdes; audit append-only; sem segredos em repo |
| G16 Interface | ✅ | Playwright Edge: 11/11 checks; screenshots desktop/mobile; abas navegáveis; login; captação; REAL vs SIMULAÇÃO |
| G17 Qualidade | ✅ | lint 0, typecheck 10/10, 58/58 testes, build OK |
| G18 Governança | ✅ | docs/onda-01 (9 arquivos), commits atômicos, pendências inventariadas |

**Onda 01 NÃO declarada integralmente aprovada**: G10 parcial (Redis) e G11 fila pendente.
