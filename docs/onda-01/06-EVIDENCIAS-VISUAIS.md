# Onda 01 — Evidências Visuais

Ferramenta: `scripts/pw-visual.mjs` + `scripts/pw-mobile.mjs` (playwright-core + Edge channel, headless).
Viewport desktop 1440×900 · mobile 390×844. Screenshots em `docs/onda-01/evidencias/`.

| Arquivo | Cena |
|---|---|
| desktop-captacao.png | Aba Captação pública + formulário + login escritório |
| desktop-login-pipeline.png | Dashboard pós-login, demo executado, selo SIMULAÇÃO |
| mobile-captacao.png | Captação+login em 390px, sem overflow |
| mobile-dashboard.png | Dashboard mobile pós-login |
| mobile-leads.png | Leads mobile com badges REAL/SIMULAÇÃO |

## Checks executados (11/11 PASS)
- Carregamento desktop/mobile, ausência de overflow horizontal.
- Formulário de captação: preenchimento → sucesso (mensagem de registro/duplicata).
- Login real → dashboard; "Rodar fluxo demo" → aprovação pendente.
- Navegação: Aprovações (botões Aprovar/Rejeitar), Leads (REAL vs SIMULAÇÃO), Agentes (6 cards).
- Selo "MODO SIMULAÇÃO" sempre visível; distinção visual demo vs real via badges.

## Acessibilidade básica
- Labels associadas aos inputs, `aria-hidden` no honeypot, `nav` com `aria-label`, roles/contraste herdados do tema.
- Office 3D NÃO iniciado (placeholder 2D preservado, estações mapeadas p/ eventos futuros).
