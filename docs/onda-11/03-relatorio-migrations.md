# Onda 11 — Relatório de Migrations

## 1. Identificação da Migration
- **Arquivo:** `packages/db/prisma/migrations/20261113183000_onda11_commercial_pipeline/migration.sql`
- **Data de Execução:** 13/11/2026 18:30:00
- **Alvo:** PostgreSQL 17.12 Nativo (`127.0.0.1:5437`, database `birthub_growth_office_dev`)

## 2. Alterações Realizadas no Schema

### 2.1 Enums Atualizados
- **`OpportunityStage`**: Expandido com valores específicos da prospecção institucional:
  `new`, `awaiting_approval`, `qualified`, `followup_planned`, `proposal_pending`, `proposal_sent_simulated`, `negotiation`, `won`, `lost`, `nurture`.
- **`OpportunityPriority`**: Adicionado enum (`low`, `medium`, `high`, `critical`).

### 2.2 Tabela `opportunities`
Campos adicionados e mapeados:
- `priority`: Enum `OpportunityPriority` (default `medium`).
- `dossier_id`: Texto referenciando dossiê Scout.
- `batch_id`: Texto referenciando lote de importação.
- `icp_score`: Inteiro (0 a 100) refletindo aderência ao ICP.
- `evidence`: JSONB contendo razões, lacunas e evidências do dossiê.
- `assigned_agent_id`: Agente atualmente responsável pela etapa (ex: `meridian`, `beacon`, `pledge`).
- `current_mission_id`: ID da missão dos agentes vinculada à oportunidade.
- `next_action`: Descrição textual da próxima ação comercial planejada.
- `next_action_due_at`: Timestamp para execução da próxima ação.
- `rejection_reason`: Justificativa em caso de estágio `lost`.
- `correlation_id`: Identificador de correlação distribuída.
- `version`: Inteiro para controle de concorrência otimista.

### 2.3 Índices Criados
- `idx_opportunities_company_id` em `(company_id)`
- `idx_opportunities_stage` em `(stage)`
- `idx_opportunities_assigned_agent` em `(assigned_agent_id)`
- `idx_opportunities_created_at` em `(created_at)`

### 2.4 Tabela `opportunity_history`
Criada para auditoria append-only das movimentações de oportunidade:
- `id`: UUID Primary Key
- `opportunity_id`: Foreign Key (`opportunities.id`) com CASCADE no delete
- `workspace_id`: Foreign Key (`workspaces.id`)
- `from_stage`: Estágio anterior
- `to_stage`: Novo estágio
- `actor_id`: Usuário ou agente executor
- `reason`: Justificativa obrigatória da mudança
- `metadata`: JSONB com contexto adicional
- `created_at`: Timestamp da movimentação

## 3. Integridade e Execução
A migration foi aplicada utilizando `pnpm --filter @bgo/db db:migrate:deploy`. Não houve perda de dados pré-existentes, e todas as tabelas e índices estão consistentes com o Prisma Client gerado.
