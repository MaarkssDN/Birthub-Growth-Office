# Relatório de Segurança, Isolamento e Governança L0–L4 — Onda 13
## Bloqueio de Disparo Externo e Conformidade Estrita (G179, G183)

### 1. Modelo de Autonomia L0–L4 e Proibições Estritas

O Birthub Growth Office implementa taxonomia rigorosa de autonomia em todas as camadas de software:

- **L0 (Supervisão & Governança)**: Aegis valida políticas, orçamentos e permissões de forma determinística antes do disparo de qualquer ação.
- **L1 (Coordenação de Fluxo)**: Relay organiza a fila de tarefas e dependências internas.
- **L2 (Execução de Especialistas)**: Scout, Meridian, Beacon e Pledge realizam análises, diagnósticos e elaboram rascunhos.
- **L3 (Aprovação Humana Obrigatória)**: Todas as ações de impacto comercial ou transição crítica de estágio dependem de decisão explícita do operador.
- **L4 (Autonomia Total / Ações Irreversíveis)**: **ESTRITAMENTE PROIBIDO**.

> **Regra Inviolável de L4**: Disparo em massa, pagamentos, contratos automáticos, bypass de política de segurança ou alteração de infraestrutura são bloqueados por hardware e contratos de código.

---

### 2. Bloqueio Técnico de Disparos Externos (`channel.send`)

Durante a Onda 13, o motor de políticas (`evaluatePolicy` em `@bgo/agents`) bloqueia qualquer tentativa de envio externo de mensagens, e-mails ou chamadas telefônicas:
```ts
if (tool === "channel" && action === "send") {
  return {
    allowed: false,
    reason: "Bloqueio estrito da política de governança L3: envios externos reais estão desativados na Onda 13",
    requiresApproval: true,
  };
}
```
Mesmo após a homologação de um rascunho pelo operador humano na Central de Aprovações:
- O status do rascunho é atualizado para `approved`.
- A oportunidade comercial avança para `followup_planned`.
- **Nenhum socket de rede, webhook de envio ou chamada SMTP externa é realizada**.
- A UI nunca atua como autoridade final de permissão: a verificação reside no núcleo do backend Fastify.

---

### 3. Proteção e Conformidade de Dados Pessoais (LGPD)

- **Dados Sintéticos (`synthetic: true`)**: Todos os leads e empresas criados ou manipulados durante os testes e homologações são sintéticos.
- **Isolamento de Base**: O repositório e o banco de dados do Growth Office são 100% segregados do projeto Birthub 360°.
- **Trilha de Auditoria Append-Only**: Todas as tentativas de acesso, avaliações de políticas e decisões humanas são gravadas na tabela `AuditEvent`, não permitindo mutações ou deleções retroativas.
