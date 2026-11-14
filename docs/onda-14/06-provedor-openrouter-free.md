# Onda 14 — Relatório 06: Provedor OpenRouter (:free Models)

**Projeto:** Birthub Growth Office (BGO)  
**Provedor:** OpenRouter (`https://openrouter.ai/api/v1`)  
**Data:** 14 de Novembro de 2026  

---

## 1. Regra de Governança Estrita: Sufixo `:free`

O OpenRouter agrega centenas de modelos de diversos provedores globais, incluindo modelos tarifados de alto custo (GPT-4o, Claude 3.5 Sonnet) e modelos mantidos em regime 100% gratuito pela comunidade e parceiros.

Sob as regras da Onda 14 e a política orçamentária de R$ 0,00:
> **Regra Programática Inviolável:** O adaptador `OpenRouterProvider` rejeita imediatamente e sem realizar chamada HTTP qualquer modelo que NÃO termine rigorosamente com o sufixo `:free`.

```typescript
if (!model.endsWith(":free")) {
  return {
    ok: false,
    provider: this.name,
    model,
    error: `Modelo '${model}' bloqueado: política de custo zero exige sufixo ':free' no OpenRouter`,
  };
}
```

---

## 2. Modelos Gratuitos Homologados

- `meta-llama/llama-3.2-3b-instruct:free` (modelo padrão)
- `qwen/qwen-2.5-7b-instruct:free`
- `google/gemma-2-9b-it:free`

---

## 3. Headers e Rastreabilidade

O adaptador envia os cabeçalhos exigidos pela governança da plataforma OpenRouter:
- `HTTP-Referer`: `https://birthub-growth-office.local`
- `X-Title`: `Birthub Growth Office`
- `Authorization`: `Bearer ${OPENROUTER_API_KEY}`
