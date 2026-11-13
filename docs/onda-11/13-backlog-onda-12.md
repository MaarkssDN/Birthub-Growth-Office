# Onda 11 — Backlog para Onda 12

## 1. Oportunidades Identificadas para a Onda 12

### 1.1 Conectividade de Canais e Envio Controlado (Outbound Sandboxed)
- **Status Atual**: Minutas de abordagem do Beacon são salvas como rascunhos auditáveis; `channel.send` permanece categoricamente bloqueado no policy engine.
- **Proposta para Onda 12**:
  - Implementar adaptadores de canal com sandbox (ex: E-mail SMTP simulado, WhatsApp sandbox com número de teste dedicado).
  - Permitir que minutas aprovadas por supervisores humanos na Central de Aprovações sejam disparadas unicamente para destinatários de teste ou homologação (`test_recipients_only`), sem risco de envio a contatos reais.

### 1.2 Conexão com Provedor de IA Real (G85 / G144)
- **Status Atual**: `BGO_AI_MODE=simulated`, G85 e G144 honestamente bloqueados por ausência de credencial no ambiente.
- **Proposta para Onda 12**:
  - Homologar um endpoint com credencial autenticada (Gemini API ou OpenAI-compatible), mantendo orçamento diário com corte atômico via `CostLedgerPort`.
  - Executar rodada de teste com dados sintéticos avaliando qualidade da redação de minutas do Beacon e enriquecimento semântico do Meridian.

### 1.3 Matriz de ICP Customizável
- **Status Atual**: A pontuação de ICP utiliza pesos heurísticos fixos com regras determinísticas baseadas em CNAE, porte, setor e UF.
- **Proposta para Onda 12**:
  - Permitir que o operador configure critérios personalizados de ICP por workspace (ex: faixas de faturamento, setores prioritários, filtros geográficos específicos).
  - Recálculo dinâmico de score ao alterar critérios de perfil.

### 1.4 Ações de Acompanhamento Automatizadas no Escritório 3D
- **Status Atual**: O agente Pledge registra próximos passos na oportunidade e reflete estado no canvas Three.js.
- **Proposta para Onda 12**:
  - Adicionar cronômetro visual no avatar 3D do Pledge indicando tempo restante para o vencimento de compromissos pendentes.
  - Alertas sonoros/visuais sutis no escritório quando uma aprovação prioritária for solicitada por um dos agentes.
