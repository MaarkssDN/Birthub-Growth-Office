# Onda 14 — Relatório 08: Adaptador xAI Grok e Controle de Custos Tarifados

**Projeto:** Birthub Growth Office (BGO)  
**Provedor:** xAI Grok (`https://api.xai.com/v1`)  
**Data:** 14 de Novembro de 2026  

---

## 1. Diretriz Obrigatória da Missão (Gate G197)

> **Diretriz da Missão:** "Grok/xAI — somente quando houver créditos promocionais válidos e suficientes, ou autorização explícita de gastos. Não contratar planos, adicionar meios de pagamento ou habilitar modelos cobrados. O orçamento padrão para chamadas externas deverá ser R$ 0."

---

## 2. Implementação do Adaptador `XaiProvider`

Localizado em `packages/ai/src/providers/xai.ts`:
1. **Bloqueio Padrão Inviolável:**
   - O adaptador verifica a variável booleana `XAI_AUTHORIZED_SPEND`.
   - Por padrão, `authorizedSpend` é `false`.
   - O status do provedor é reportado honestamente como:
     `blocked_unauthorized_expense`
2. **Rejeição Programática de Chamadas:**
   - Caso qualquer rotina tente invocar `complete()` no xAI sem autorização explícita, a chamada é abortada antes de tocar na rede:
     ```typescript
     if (!this.authorizedSpend) {
       return {
         ok: false,
         provider: this.name,
         error: "xAI Grok bloqueado: política de custo zero (R$ 0) proíbe chamadas tarifadas sem autorização explícita (XAI_AUTHORIZED_SPEND=1)",
       };
     }
     ```
3. **Contabilidade de Tarifas:**
   - Em caso de ativação com créditos autorizados, o consumo gera registro em `costUnits` e emite evento para o `CostLedger`.
