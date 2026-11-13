# Onda 11 — Matriz de Gates de Homologação

| Gate | Descrição | Status | Evidência / Validação |
|---|---|:---:|---|
| **G116** | Conexão do Scout ao Pipeline Comercial e Missão de Agentes | ✅ **APROVADO** | Empresas aprovadas tornam-se oportunidades e alimentam missão integrada de 6 agentes. |
| **G130** | Preservação: zero regressões das Ondas 00–10 | ✅ **APROVADO** | Suíte completa com 110 testes passando em 20 arquivos (100% green). |
| **G131** | Empresa para oportunidade: criação funcional e autorizada | ✅ **APROVADO** | Bloqueio para empresas não aprovadas; criação autorizada vinculando dossiê, lote e empresa. |
| **G132** | Deduplicação: nenhuma duplicação sob retry ou concorrência | ✅ **APROVADO** | Advisory lock PostgreSQL (`pg_advisory_xact_lock`) e validação de chave; 5 chamadas simultâneas geram 1 criada e 4 idempotentes. |
| **G133** | Proveniência: vínculo entre empresa, importação, dossiê e oportunidade | ✅ **APROVADO** | Preservação estrita de `companyId`, `dossierId`, `batchId`, `icpScore`, `evidence` e `correlationId`. Zero contatos fictícios. |
| **G134** | Pipeline: estágios e transições auditáveis | ✅ **APROVADO** | Máquina de estados estrita com 10 estágios; transições inválidas bloqueadas; justificativa obrigatória registrada em histórico append-only. |
| **G135** | Seis agentes: missão comercial integrada e persistente | ✅ **APROVADO** | Aegis, Relay, Scout, Meridian, Beacon e Pledge orquestrados com registro de entradas, saídas, status, tempo e missão no banco. |
| **G136** | Aprovações: todas as ações sensíveis supervisionadas | ✅ **APROVADO** | 6 ações sujeitas a aprovação humana (promoções, minutas de prospecção, overrides de prioridade e orçamento). |
| **G137** | Central Scout: interface testada em desktop e mobile | ✅ **APROVADO** | Playwright desktop (1440x900) e mobile (390x844) verdes; importação CSV, listagem, filtros, dossiê e promoção homologados. |
| **G138** | Custos IA: interface e orçamento verificados | ✅ **APROVADO** | Painel de custos auditando modo simulado, tarifas vigentes e limites de orçamento com barras de progresso. |
| **G139** | Escritório 3D: eventos e missões refletidos corretamente | ✅ **APROVADO** | Agente Scout interativo com dossiê, painel de contexto comercial e SSE integrado aos eventos de oportunidade. |
| **G140** | Infraestrutura: Prisma e build reproduzíveis | ✅ **APROVADO** | Script `prisma-safe-generate.mjs` sem EPERM; code-splitting do Three.js e build green em 14.64s sem OOM. |
| **G141** | Segurança: testes negativos e isolamento aprovados | ✅ **APROVADO** | Isolamento por workspaceId verificado em unit/api/pg; RBAC restrito; proteção contra formula injection e CSV malicioso. |
| **G142** | Qualidade: lint, typecheck, testes, build e Playwright verdes | ✅ **APROVADO** | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e Playwright (35/35 checks) 100% aprovados. |
| **G143** | Independência: zero dependência operacional do Birthub 360° | ✅ **APROVADO** | Suíte `tests/isolation/isolation.test.ts` verde; isolamento de código, banco (5437), redis (6387) e portas (4180/4181). |
| **G144** | IA real: aprovada com inferência autenticada ou bloqueada por credencial | ⚠️ **BLOQUEADO** | Sem chave `BGO_AI_API_KEY` no ambiente local; honestidade operacional mantida, simulado sinalizado (`simulated: true`). |
