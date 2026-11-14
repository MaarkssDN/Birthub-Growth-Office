# Onda 14 — Relatório 05: Provedor Google Gemini (Free Tier)

**Projeto:** Birthub Growth Office (BGO)  
**Provedor:** Google Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/`)  
**Data:** 14 de Novembro de 2026  

---

## 1. Características e Limites

O Google Gemini oferece uma das APIs gratuitas mais estáveis para modelos multimodais e textuais via endpoint compatível com OpenAI:
- **Modelo Principal:** `gemini-1.5-flash`.
- **Modelo Alternativo:** `gemini-2.0-flash`.
- **Cota Free Tier Oficial:**
  - 15 requisições por minuto (RPM).
  - 1.000.000 de tokens por minuto (TPM).
  - 1.500 requisições por dia (RPD).
- **Tarifa Financeira:** R$ 0,00 no plano gratuito da Google AI Studio.

---

## 2. Implementação do Adaptador `GeminiProvider`

Localizado em `packages/ai/src/providers/gemini.ts`:
1. **Endpoint OpenAI-Compatible:** Utiliza o base URL `https://generativelanguage.googleapis.com/v1beta/openai` com header de autorização `Bearer ${GEMINI_API_KEY}`.
2. **Status Auditável:** Se a variável `GEMINI_API_KEY` não estiver preenchida no ambiente, assume `blocked_no_credential`.
3. **Resiliência a Quotas:** Em caso de resposta HTTP 429 ou esgotamento temporário da cota diária/minuto, aciona o fallback para o OpenRouter (`:free`).
4. **Proteção LGPD:** Aplicada no roteador central antes do despacho.
