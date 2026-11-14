# Onda 14 — Relatório 10: Guarda de Privacidade e Conformidade LGPD

**Projeto:** Birthub Growth Office (BGO)  
**Governança de Dados:** Gate G200 e Regra Inviolável 3  
**Data:** 14 de Novembro de 2026  

---

## 1. Princípio do Isolamento de Dados

A transmissão de informações confidenciais ou dados pessoais não anonimizados para serviços em nuvem de terceiros representa violação severa de conformidade LGPD.

No BGO:
- **Ollama Local:** É classificado como `privacyTier: "local_confidential"`. Processa dados no perímetro da máquina sem transmitir bytes para a WAN.
- **Provedores Cloud:** São classificados como `privacyTier: "synthetic_only"`. Aceitam exclusivamente dados com flag `synthetic: true` e sanitizados.

---

## 2. Implementação da Guarda em `AiRouter`

Em `packages/ai/src/router.ts`:
Antes de encaminhar uma inferência para provedores externos (Groq, Gemini, OpenRouter, Cloudflare, xAI), o roteador submete o payload à inspeção:

```typescript
if (!adapter.isLocal) {
  const inputStr = JSON.stringify(req.input);
  const hasPiiPattern =
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/.test(inputStr) ||
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(inputStr);

  if (hasPiiPattern) {
    // Intercepta e bloqueia envio externo de PII
    this.logInference({
      ...,
      status: "blocked",
      error: "Bloqueio de privacidade: PII não sanitizada em chamada externa",
    });
    continue; // Tenta provedor local ou fallback
  }
}
```

A função `sanitizeLeadForAi` em `packages/ai/src/meridian.ts` atua preventivamente, descartando telefones, e-mails, números de WhatsApp e documentos antes da formação do prompt do Meridian.
