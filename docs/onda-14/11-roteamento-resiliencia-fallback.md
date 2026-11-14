# Onda 14 — Relatório 11: Roteamento Inteligente, Resiliência e Fallback

**Projeto:** Birthub Growth Office (BGO)  
**Governança de Execução:** Gate G198  
**Data:** 14 de Novembro de 2026  

---

## 1. Funcionamento do Algoritmo de Roteamento

O `AiRouter` orquestra a cadeia de execução com lógica de **degradação graciosa**:

1. **Determinação da Cadeia de Candidatos:**
   - Se a requisição contiver `preferredProvider`, ele é testado como candidato #1.
   - Os demais provedores da lista de prioridade são enfileirados como alternativas sequenciais.
2. **Inspeção de Disponibilidade:**
   - Para cada provedor, o router consulta `getStatus()`.
   - Se o status for `blocked_no_credential`, `service_down`, ou `blocked_unauthorized_expense`, ele é ignorado sem perda de tempo de rede.
3. **Execução e Tratamento de Exceções:**
   - Se o provedor falhar durante a chamada (timeout, HTTP 500, HTTP 429 rate limit, erro de parsing):
     - Um log de falha é registrado no histórico de auditoria.
     - O roteador imediatamente avança para o próximo candidato.
4. **Fallback Final Seguro:**
   - Se todos os provedores reais falharem ou estiverem sem chave, o `MockDeterministicProvider` é acionado.
   - O resultado é entregue com sucesso à UI, porém com flag estrita `simulated: true` e prefixo `[SIMULADO]` na mensagem, cumprindo a Regra de Honestidade de Estado (Regra Inviolável 7).
