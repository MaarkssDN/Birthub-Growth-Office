# Onda 11 — Evidências da Central de Aprovações

## 1. Supervisão Humana Obrigatória (Human-in-the-Loop)
Em conformidade com `AGENTS.md` (regras L0–L4), o sistema veda categoricamente a autonomia L4 para ações comerciais externas ou mutações críticas de política/orçamento.

A Central de Aprovações consolidou 6 fluxos obrigatórios de supervisão:
1. `company.promote_opportunity`: Promoção de empresa analisada para o pipeline de prospecção comercial.
2. `opportunity.outreach_review`: Aprovação humana formal da minuta de abordagem redigida pelo agente Beacon (a aprovação mantém o envio bloqueado até futura autorização de canal).
3. `opportunity.sensitive_change`: Alterações sensíveis em oportunidades (ex: fechamento, descarte atípico, redefinição de termos).
4. `opportunity.priority_override`: Elevação manual de prioridade para `critical` sem preencher os requisitos heurísticos automáticos.
5. `external.activity_request`: Solicitação para criação de reunião externa, call ou contato fora do sistema.
6. `budget.limit_override`: Tentativa de execução de missão que ultrapasse o teto de gastos configurado para o workspace.

## 2. Implementação e Endpoints
- **Listagem e Filtros:** `GET /api/approvals?status=pending&action=...`
- **Decisão:** `POST /api/approvals/:id/decide` (decisão: `approved` | `rejected`, com justificativa obrigatória `reason`).
- **Submissão Manual de Supervisão:** `POST /api/approvals` (solicitação de revisão por operadores e agentes).

## 3. Garantias de Auditoria
- Cada decisão registra:
  - `decidedBy`: Identificador do operador com permissão (`approvals:write` / `admin`).
  - `decidedAt`: Timestamp exato da decisão.
  - `decisionReason`: Justificativa auditável persistida de forma imutável.
- Emissão de evento de outbox: `approval.decided.v1`.
- Gravação no ledger append-only `AuditEvent`.
- A aprovação de uma minuta de prospecção não realiza disparo automático externo (`channel.send` permanece bloqueado por política de segurança).

## 4. Evidências Playwright
- `docs/onda-11/evidencias/desktop-approvals.png`: Lista de pendências de aprovação com filtros por status e ação.
- `docs/onda-11/evidencias/mobile-approvals.png`: Interface de aprovação responsiva em mobile.
