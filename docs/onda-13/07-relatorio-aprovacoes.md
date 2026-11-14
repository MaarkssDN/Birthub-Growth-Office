# Relatório da Central de Aprovações e Revisão Humana — Onda 13
## Supervisão Humana Obrigatória e Segregação de Funções (G178, G179)

### 1. Princípio Fundamental de Governança
Nenhuma ação comercial de impacto externo pode ser executada por decisão autônoma de inteligência artificial. A Central de Aprovações do Birthub Growth Office implementa o conceito de **Human-in-the-Loop Obrigatório (L3)**, com as seguintes regras invioláveis:
1. **Regra de Segregação de Funções (Quatro Olhos)**: O solicitante da aprovação (`requestedBy`) **nunca pode ser o mesmo usuário que aprova** (`decidedBy`). Tentativas de auto-aprovação lançam erro explícito e são registradas como violação na trilha de auditoria.
2. **Escopo Restrito da Aprovação**: A aprovação do operador humano (`decision: "approved"`) autoriza **estritamente a preparação e organização do material** (ficha consolidada, deck executivo e proposta). O disparo externo direto permanece tecnicamente bloqueado pelo policy engine no backend.
3. **Opção de Rejeição com Motivação Obrigatória**: Em caso de rejeição (`decision: "rejected"`), o operador deve fornecer a justificativa ou orientações de revisão, retornando a oportunidade ao estágio comercial anterior (`nurture` ou `researching`).

---

### 2. Ações Supervisionadas Homologadas (`SUPERVISED_ACTIONS`)

O backend valida estritamente a lista canônica de ações sob controle de aprovação:
- `company.promote_opportunity` — Promoção de empresa do Scout para o pipeline comercial.
- `opportunity.sensitive_change` — Alteração de prioridade, valor ou cancelamento de oportunidade.
- `opportunity.outreach_review` — Revisão de rascunho de abordagem preparado pelo Beacon.
- `dossier.approve_preparation` — Homologação da Ficha Consolidada / Dossiê Comercial Integrado (Onda 13).
- `commercial.outreach_dispatch` — Homologação de preparação de envio (disparo real bloqueado na Onda 13).
- `external.activity_request` — Requisições de atividade externa sob política L3.
- `icp.activate` — Ativação de nova versão de perfil de ICP comercial.
- `offer.approve` — Homologação de nova alegação no catálogo de oferta comercial.
- `budget.limit_override` — Superação controlada de teto diário de consumo de IA.

---

### 3. Registro Imutável de Decisão

Ao registrar uma decisão através de `POST /api/opportunities/:id/dossier/review`:
- É emitido o evento de domínio `pilot.dossier_reviewed.v1` contendo:
  ```json
  {
    "approvalId": "appr_...",
    "opportunityId": "opp_...",
    "decision": "approved",
    "decidedBy": "user:approver_1",
    "externalSendBlocked": true
  }
  ```
- É gravado registro append-only na tabela `AuditEvent` com `outcome = "allowed"` e detalhes completos da decisão.
