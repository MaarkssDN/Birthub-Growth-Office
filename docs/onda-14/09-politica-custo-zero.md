# Onda 14 — Relatório 09: Política de Custo Zero (Orçamento R$ 0,00)

**Projeto:** Birthub Growth Office (BGO)  
**Governança Financeira:** Gate G199  
**Data:** 14 de Novembro de 2026  

---

## 1. Princípio Fundamental

O BGO opera com um compromisso financeiro transparente: **orçamento de chamadas externas de IA rigorosamente fixado em R$ 0,00**.

Isso significa:
1. Nenhuma cobrança em cartão de crédito corporativo ou pessoal.
2. Nenhuma contratação de planos pagos de APIs de IA.
3. Prioridade incondicional para recursos de hardware já disponíveis localmente (Ryzen 5 5625U, 24GB RAM).
4. Utilização exclusiva de cotas gratuitas legítimas e homologadas (GroqCloud free, Gemini free, OpenRouter `:free`, Cloudflare free).

---

## 2. Salvaguardas Programáticas Implementadas

- **Trava de Custo Externo (`maxExternalCostBrl: 0`):** O registro central de IA (`AiProviderRegistry`) expõe a política `maxExternalCostBrl = 0` e `allowPaidTier = false`.
- **Validação de Sufixo no OpenRouter:** Qualquer modelo sem `:free` é rejeitado na origem.
- **Bloqueio de Provedores Pagos:** Modelos de provedores com `costTier === "paid"` (ex: xAI) são bloqueados a nível de código (`blocked_unauthorized_expense`).
- **CostLedger Integrado (Onda 10):** Toda execução, inclusive local, emite registros para o `CostLedger`, garantindo auditoria de volume de tokens e custo computacional estimado.
