# Meridian/Gemini (G85-equivalente)
- AI Gateway inalterado na arquitetura: BGO_AI_MODE=real + BGO_AI_API_KEY +
  BGO_AI_ENABLED=1; BGO_AI_BASE_URL/BGO_AI_MODEL configuráveis (Gemini
  OpenAI-compatible cabe sem mudança de código).
- Sem credencial: modo SIMULADO mantido; G74/G85 seguem BLOQUEADO.
- Novidade Onda 10: toda chamada (real ou mock) emite registro de uso
  com missionId/correlationId — pronto p/ custo real quando houver chave.
- diagnose continua com guarda anti-promoções e sanitizeLeadForAi.
