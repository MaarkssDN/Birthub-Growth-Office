# Backlog e Recomendações — Onda 14
## Disparo Externo Controlado e Expansão da Operação Comercial

### 1. Visão Geral da Onda 14
A Onda 14 terá como missão evoluir a operação comercial supervisionada da fase de preparação de materiais para a fase de **disparo externo controlado**, ativando canais de comunicação com provedores autorizados mediante autorização explícita e credenciamento seguro.

---

### 2. Épicos e Itens Prioritários

#### Épico 1: Ativação Controlada de Provedor de E-mail Transacional
- Configuração de conector seguro para provedor de e-mail (ex.: Resend / AWS SES / SendGrid) em sandbox restrito.
- Validação de SPF, DKIM e DMARC corporativo exclusivo do Growth Office (`@growth.birthub.local` / subdomínio isolado).
- Remoção controlada do bloqueio de `channel.send` apenas para o canal `email` e exclusivamente sob token de aprovação de operador humano de nível `owner`.

#### Épico 2: Gestão de Respostas e Inbound de Feedback
- Conector de webhook para recebimento de respostas de prospects.
- Classificação automatizada de sentimento e intenção pelo Meridian.
- Encaminhamento automático de leads interessados para o roteiro de tour 360 guiado.

#### Épico 3: Credenciamento Seguro do AI Gateway
- Configuração confidencial da chave `BGO_AI_API_KEY` para ativação da inferência real do Meridian (desbloqueio do G172).
- Comparação contínua de acurácia entre os diagnósticos determinísticos e as inferências do modelo LLM.
- Controle fino de rate limiting e orçamento de tokens por workspace.

#### Épico 4: Agendamento Real de Demonstrações (Calendário)
- Integração supervisionada de links de agendamento (Google Calendar / Calendly corporativo).
- Atualização em tempo real do indicador de Reuniões Realizadas no painel de métricas (transição de `absent` para contagem real comprovada).
