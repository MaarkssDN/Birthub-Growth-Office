# Onda 11 — Evidências: Empresa para Oportunidade

## 1. Regra de Negócio e Homologação
A promoção de uma empresa importada na Central Scout para oportunidade comercial exige:
1. Status de revisão da empresa ser `approved` (empresas `pending_review` ou `rejected` têm a promoção terminantemente recusada).
2. Ação autorizada por usuário com permissão comercial (`leads:write` / `deals:write`).
3. Preservação integral do vínculo com a empresa (`companyId`), dossiê (`dossierId`), lote original (`batchId`) e `correlationId`.
4. Ausência absoluta de criação de contatos pessoais sintéticos/falsos.

## 2. Testes Automatizados Executados

### 2.1 Teste de Unidade (`tests/unit/opportunity-store.test.ts`)
- `G131`: Bloqueia promoção de empresa não aprovada (`pending_review` resulta em erro `"empresa precisa estar aprovada antes de ser promovida a oportunidade"`).
- `G131`: Cria oportunidade autorizada para empresa `approved`, gerando histórico de oportunidade (`opportunity_history`) e histórico da empresa (`company_history`).
- `G132`: Deduplicação garantida em retry: segunda tentativa de promoção da mesma empresa retorna o registro existente com flag `duplicated: true`.
- `G134`: Valida máquina de estados e impede transições inválidas (ex: de `new` direto para `won`).

### 2.2 Teste de Integração com PostgreSQL Real (`tests/api/onda11.test.ts`)
- Criação de lote CSV no banco `birthub_growth_office_dev`.
- Aprovação humana formal da empresa via endpoint `POST /api/scout/companies/:id/review`.
- Execução concorrente de 5 chamadas simultâneas `POST /api/scout/companies/:id/promote-opportunity`.
- Resultado auditado:
  - Exatamente **1 oportunidade criada** (`created: true`).
  - **4 chamadas retornaram a mesma oportunidade** com `created: false` e `duplicated: true`.
  - Zero duplicação no PostgreSQL.
  - Vínculos com `dossierId`, `batchId`, `icpScore` e `evidence` integralmente preservados.
  - Nenhum registro criado na tabela `contacts` ou `leads`.
