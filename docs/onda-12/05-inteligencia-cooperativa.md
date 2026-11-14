# Inteligência Cooperativa entre os Seis Agentes Ativos
**Birthub Growth Office — Onda 12**

## 1. O Pipeline Cooperativo
A missão comercial opera com distribuição de responsabilidades estrita entre os 6 agentes ativos do catálogo canônico:

1. **Aegis (Supervisão Central):** Interpreta o objetivo comercial da conta, alinha a missão com o teto de autonomia e estabelece o plano de governança.
2. **Relay (Coordenação Comercial):** Cria as tarefas das etapas com dependências lineares, controla prazos e distribui execuções.
3. **Scout (Investigação de Contas):** Recupera o dossiê da empresa, situação cadastral, CNAE, porte e evidências apuradas na importação.
4. **Meridian (Qualificação SDR):** Aplica a versão ativa do ICP Dinâmico e emite a saída estruturada tripartida:
   - **Fatos:** Evidências comprovadas documentalmente no dossiê.
   - **Inferências:** Pontuação e probabilidades baseadas na rubrica configurada.
   - **Recomendações:** Prioridade de abordagem e próximos passos determinísticos.
5. **Beacon (Prospecção Outbound):** Elabora o rascunho de comunicação personalizada consultando **exclusivamente alegações aprovadas** do catálogo de oferta. Envio externo permanece rigorosamente bloqueado.
6. **Pledge (Compromissos e Follow-up):** Organiza as atividades seguintes, vincula solicitações à Central de Aprovações e agenda lembretes de acompanhamento.

## 2. Contratos de Saída Estruturada
O contrato `@bgo/contracts` define o schema `StructuredAgentOutput`:
```typescript
export interface StructuredAgentOutput {
  facts: string[];
  inferences: string[];
  recommendations: string[];
}
```
A separação categórica impede alucinações e garante que suposições comerciais não sejam apresentadas ao operador humano como certezas fáticas.
