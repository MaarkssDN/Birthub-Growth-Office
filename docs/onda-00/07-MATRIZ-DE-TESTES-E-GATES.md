# BGO · Onda 00 — Matriz de Testes e Gates

## 1. Comandos de verificação (G02)

| Comando | O que prova |
|---------|-------------|
| `pnpm install --frozen-lockfile` | reprodutibilidade de deps |
| `pnpm -r lint` | eslint flat config, 0 erros |
| `pnpm -r typecheck` | `tsc --noEmit` strict em todos os pacotes |
| `pnpm -r test` | vitest: unit + policies + api + fluxo E2E mock |
| `pnpm -r build` | vite build (web) + tsc build (api/worker/packages) |

## 2. Cobertura de testes

| Área | Arquivo | Foco |
|------|---------|------|
| Catálogo | `tests/catalog` | 29 IDs, 9+15+4+1, 6 ativos, IDs únicos (G03) |
| Políticas | `tests/policies` | negativas: send externo, pagamento, contrato, mass send, self-approval, cross-tenant, policy bypass (G04) |
| Lead machine | `tests/unit` | transições válidas/inválidas, suppressed terminal |
| Eventos | `tests/unit` | envelope Zod, versionamento, redactPII |
| API | `tests/api` | REST smoke via `app.inject`, auth local, SSE headers |
| Fluxo | `tests/e2e-mock` | lead sintético → aprovação pendente, correlationId, flag SIMULADO (G05/G06) |
| Isolamento | `tests/isolation` | varredura: nenhuma string/URL/credencial do Birthub 360° no repo (G01/G08) |
| Claims | `tests/unit` | Beacon só referencia claims `approved`; pendentes bloqueados (G00) |

## 3. Gates → evidência → estado

| Gate | Evidência | Estado |
|------|-----------|--------|
| G00 verdade comercial | docs/01 + offer-claims fixture + teste de claims | ver docs/09 |
| G01 isolamento | tests/isolation + nomes bgo_* + portas | ver docs/09 |
| G02 reprodutibilidade | logs de install/lint/tsc/test/build | docs/09 |
| G03 catálogo 29 | teste registry | docs/09 |
| G04 políticas | testes negativos | docs/09 |
| G05 fluxo interno | E2E mock | docs/09 |
| G06 auditoria | fixtures de eventos + audit trail | docs/09 |
| G07 UI | build web + smoke manual | docs/09 |
| G08 segurança | .env.example sanitizado, sem segredos, localhost | docs/09 |
| G09 relatório | este doc-set + docs/09 | docs/09 |

## 4. Critério de falha

Qualquer gate sem evidência executável = `NÃO APROVADO`. Documentação sozinha
nunca aprova gate.
