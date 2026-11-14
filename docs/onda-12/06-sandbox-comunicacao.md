# Sandbox de Comunicação Comercial Supervisionada
**Birthub Growth Office — Onda 12**

## 1. Princípios Invioláveis
1. **Zero Disparos Externos Reais:** O motor de políticas (`evaluatePolicy`) e o adaptador de sandbox bloqueiam qualquer invocação de ferramentas externas (SMTP real, WhatsApp API real, LinkedIn Automation).
2. **Ambiente Seguro de Teste:** O operador pode testar modelos de mensagens, templates, canais e fluxos de homologação com respostas imediatas e realistas.
3. **Idempotência Estrita:** Reenvios com o mesmo `correlationId` são identificados como duplicados (`duplicated: true`), prevenindo duplo envio por retentativa acidental ou duplo clique.
4. **Respeito ao Opt-Out:** Destinatários cadastrados na lista de supressão são bloqueados preventivamente (`blocked_suppressed`).

## 2. Cenários de Simulação Suportados
O Sandbox (`packages/commercial/src/communication-sandbox.ts`) simula as principais condições do tráfego corporativo:
- `success`: Despacho simulado com sucesso (`status: "sent_simulated"`), cabeçalhos de rastreamento `X-BGO-Sandbox: true` e mascaramento do destinatário (ex: `co***@dominio.com`).
- `network_timeout`: Simula timeout de conexão (`status: "error_simulated"`), com registro de falha de gateway.
- `bounce`: Simula devolução de mensagem por caixa postal inexistente ou rejeição de domínio.
- `rate_limit`: Simula estouro de cota por volume de homologação na janela corrente.
- `suppressed`: Bloqueia envio para endereços com solicitação prévia de opt-out.
- `unauthorized`: Bloqueia disparos sem aprovação prévia de supervisor humano (`status: "blocked_unauthorized"`).

## 3. Persistência e Auditoria
Cada tentativa de disparo no Sandbox gera um registro imutável em `CommunicationDispatch` (no PostgreSQL via `PrismaCommunicationSandboxStore`), auditado em `AuditEvent` com correlationId e emitido no barramento SSE.
