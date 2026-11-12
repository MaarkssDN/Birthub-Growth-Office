# Onda 03 — Integração de IA (FASE 04 / G33)

## Implementado
- **`packages/ai/src/meridian.ts`** — primeiro caso de uso real supervisionado:
  `meridian.diagnose.v1` gera diagnóstico comercial estruturado
  (verdict, confidence 0–1, reasonCodes, gaps, recommendedAction,
  missingInformation, humanReviewRequired).
- **`sanitizeLeadForAi`**: remove e-mail, telefone, nome e CNPJ do payload
  enviado ao modelo — PII não sai do backend.
- **`parseDiagnosis`**: valida saída do modelo contra schema estrito;
  `confidence` fora de 0–1 rejeitado.
- **Guarda anti-promessas**: saída contendo `R$`, `%`, "garantia",
  "SLA", "case de sucesso" (fora da allowlist aprovada) → `unsafeOutput`
  e rejeição — a IA não pode inventar preço/funcionalidade/prazo.
- **`claimRefs`**: só entram afirmações da `KnowledgeApprovedClaim` —
  nada de conhecimento não aprovado.
- Prompt v2 (`PROMPTS["meridian.diagnose.v1"]`) com regras duras contra
  promessas comerciais.
- **`POST /api/ai/meridian-diagnose`**: auth + rate limit 10/h +
  auditoria; aceita `leadId` (lead persistido) ou payload ad hoc;
  resposta marca `simulated: true` quando aplicável.

## Prova do contrato real (sem credenciais)
Teste sobe um servidor OpenAI-compatible stub em 127.0.0.1, configura
`BGO_AI_MODE=real` + key fake + base URL local → `provider.name ===
"openai-compatible"`, `model === "gpt-4o-mini"`, `simulated === false`,
`humanReviewRequired === true`. **Contrato do provedor validado; nenhuma
chamada a API real foi feita** — credenciais autorizadas não existem no
ambiente. Ativação real permanece **pendente de credencial**.

## Status
- `GET /api/ai/status` expõe modo honestamente.
- Nenhuma ação externa disparada; IA só gera diagnóstico interno.
- Rejeição de saída insegura verificada em teste.
