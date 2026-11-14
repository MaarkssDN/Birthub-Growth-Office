# Onda 14 — Relatório 04: Provedor GroqCloud (Free Tier)

**Projeto:** Birthub Growth Office (BGO)  
**Provedor:** GroqCloud (`https://api.groq.com/openai/v1`)  
**Data:** 14 de Novembro de 2026  

---

## 1. Características e Benefícios

O GroqCloud é a segunda prioridade na esteira de inferência devido à sua altíssima velocidade de geração em chips LPUs e a um plano gratuito oficial generoso:
- **Modelo Principal:** `llama-3.1-8b-instant`.
- **Modelos Alternativos Suportados:** `llama-3.3-70b-versatile`, `mixtral-8x7b-32768`.
- **Cota Gratuita:** 30 requisições por minuto (RPM) e 14.400 requisições por dia (RPD).
- **Tarifa Financeira:** R$ 0,00 no plano free tier.
- **Formato Estruturado:** Suporta nativamente `response_format: { type: "json_object" }`.

---

## 2. Implementação do Adaptador `GroqProvider`

Localizado em `packages/ai/src/providers/groq.ts`:
1. **Verificação de Chave:** Checa a presença de `GROQ_API_KEY` (ou `BGO_GROQ_API_KEY`).
   - Se ausente: declara status honesto `blocked_no_credential` e evita chamadas de rede desnecessárias.
   - Se presente: declara status `credentialed`.
2. **Tratamento de Rate Limit (HTTP 429):**
   - Ao receber status 429, o adaptador emite erro tipado de rate limit e devolve o fluxo ao `AiRouter`, que dispara o fallback imediato para o próximo provedor gratuito (Google Gemini).
3. **Guarda de Dados:**
   - Antes do envio para o GroqCloud, a guarda em `AiRouter` verifica se o payload contém dados sintéticos e sanitizados. Dados com PII não sanitizada são impedidos de serem transmitidos para servidores externos.
