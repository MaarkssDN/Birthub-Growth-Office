# Auditoria, Segurança e Políticas de Acesso (RBAC)
**Birthub Growth Office — Onda 12**

## 1. Controle de Acesso Baseado em Papéis (RBAC)
O sistema aplica RBAC estrito em todas as operações da Onda 12:
- **`owner`:** Permissão irrestrita de configuração, aprovação de novas versões de ICP, autorização de claims de oferta e alteração de parâmetros globais.
- **`approver`:** Autorização para decisões na Central de Aprovações (`icp.activate`, `offer.approve`, `opportunity.outreach_review`, `opportunity.sensitive_change`).
- **`operator`:** Criação de perfis rascunho de ICP, importação de CSV na Central Scout, submissão de itens para validação e testes no Sandbox de Comunicação.
- **`auditor`:** Acesso somente-leitura a trilhas de auditoria, eventos de outbox, ledger de custos e histórico de transições. Tentativas de mutação retornam HTTP 403 Forbidden.

## 2. Trilha de Auditoria Imutável (Append-Only)
Cada mutação emite um registro em `AuditEvent`:
- `actorId`: Identificação de quem solicitou a ação.
- `action`: Código canônico da operação (ex: `icp.version`, `offer.review`, `communication.sandbox_dispatch`).
- `targetType` e `targetId`: Entidade afetada.
- `correlationId`: Rastreabilidade fim a fim conectando requisições HTTP, jobs BullMQ e eventos SSE.
- `outcome`: `allowed`, `denied` ou `info`.
- `metadata`: Payload contextual para conformidade jurídica e segurança da informação.
