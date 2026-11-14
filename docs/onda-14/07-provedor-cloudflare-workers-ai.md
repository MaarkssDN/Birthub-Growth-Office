# Onda 14 — Relatório 07: Provedor Cloudflare Workers AI (Free Tier)

**Projeto:** Birthub Growth Office (BGO)  
**Provedor:** Cloudflare Workers AI  
**Data:** 14 de Novembro de 2026  

---

## 1. Características da Franquia Gratuita

A Cloudflare disponibiliza execução serverless de IA em sua rede edge global com uma cota gratuita permanente:
- **Cota Free Tier:** 10.000 neurônios por dia sem cobrança.
- **Modelos Homologados:**
  - `@cf/meta/llama-3.1-8b-instruct` (modelo padrão)
  - `@cf/mistral/mistral-7b-instruct-v0.1`
- **Tarifa Financeira:** R$ 0,00 dentro da franquia diária.

---

## 2. Implementação do Adaptador `CloudflareProvider`

Localizado em `packages/ai/src/providers/cloudflare.ts`:
1. **Credenciamento:** Requer `CLOUDFLARE_API_KEY` (Token de API com permissão de Workers AI) e `CLOUDFLARE_ACCOUNT_ID`.
2. **Endpoint REST:** Chamadas para `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`.
3. **Status Auditável:** Reporta `blocked_no_credential` caso qualquer uma das duas variáveis esteja ausente.
4. **Isolamento de Custo:** Enquadrado na política de R$ 0,00.
