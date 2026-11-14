# Escritório Virtual 3D e Experiência dos Seis Personagens
**Birthub Growth Office — Onda 12**

## 1. Preservação da Experiência 3D
O Escritório Virtual 3D construído em Three.js foi integralmente preservado e ampliado com dados contextuais em tempo real:
- Os 6 agentes ativos (Aegis, Relay, Scout, Meridian, Beacon e Pledge) ocupam suas estações de trabalho dedicadas no espaço tridimensional.
- Animações reativas refletem os estados reais dos agentes (`idle`, `listening`, `processing`, `speaking`, `success`, `error`) via eventos recebidos via Server-Sent Events (SSE).
- Suporte a fallback gracioso caso o dispositivo do operador não possua acelerador WebGL disponível.

## 2. Painéis Contextuais Comerciais por Agente
Ao selecionar qualquer agente no escritório, o painel lateral exibe informações comerciais e de governança sincronizadas:
- **Scout:** Dossiê das empresas importadas e indicação do Perfil de ICP Dinâmico vigente utilizado na triagem.
- **Aegis:** Missões ativas, correlação de governança e teto de autonomia L2/L3.
- **Relay:** Tarefas coordenadas, dependências e status das etapas do pipeline.
- **Meridian:** Resultados da qualificação SDR com discriminação clara de **Fatos**, **Inferências** e **Recomendações**, além da versão do ICP aplicada.
- **Beacon:** Rascunhos de abordagem comercial gerados, status de validação de claims e confirmação de bloqueio de envio externo.
- **Pledge:** Volume de aprovações pendentes e total de disparos registrados no Sandbox de Comunicação.
