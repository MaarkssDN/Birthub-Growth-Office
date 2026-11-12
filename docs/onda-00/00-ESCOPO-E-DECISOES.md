# BGO · Onda 00 — Escopo e Decisões

Data: 2026-11-12 · Status: EXECUÇÃO EM ANDAMENTO

## 1. Escopo

Fundação independente e compilável do **Birthub Growth Office (BGO)** — operação
comercial multiagente que venderá o **Birthub 360°** (produto externo, não clonado).

Resultado desta onda:

- Monorepo pnpm + TypeScript estrito.
- API Fastify + worker com adapters `mock` (nenhuma chamada externa).
- Frontend React+Vite com dashboard, leads, missões, aprovações, catálogo 29,
  timeline auditável e placeholder do escritório 2D.
- Catálogo canônico de 29 personagens preservado; 6 agentes ativos na onda.
- Fluxo sintético completo: lead → triagem Meridian → missão Aegis → distribuição
  Relay → dossiê Scout → rascunho Beacon → acompanhamento Pledge → aprovação humana → auditoria.

## 2. Fontes de verdade (hierarquia)

1. `references/onda-00/BIRTHUB_GROWTH_OFFICE_DOCUMENTO_MESTRE_ONDA_00_V1.html`
   (extraído para `doc-mestre.txt`) — fonte principal.
2. `references/onda-00/BIRTHUB_GROWTH_OFFICE_CATALOGO_29.json` — catálogo canônico.
3. `references/onda-00/BIRTHUB_GROWTH_OFFICE_GATES_ONDA_00.md` — gates.
4. `references/onda-00/BIRTHUB_GROWTH_OFFICE_DECISOES_E_PENDENCIAS.md` — decisões.
5. `references/onda-00/BIRTHUB_GROWTH_OFFICE_PRIMEIRO_PROMPT_ANTIGRAVITY.md` — missão.

Documentos históricos de personagens do Birthub 360° **não foram fornecidos**;
não foram copiados nem exigidos. IDs do catálogo são a única referência adotada.

## 3. Decisões registradas

| # | Decisão | Motivo |
|---|---------|--------|
| D01 | Workspace raiz `C:\Github\Birthub-Growth-Office` | Pasta vazia selecionada pelo usuário; separada do Birthub 360° |
| D02 | Persistência em modo **in-memory adapter** | Docker indisponível no ambiente; PostgreSQL/Prisma ficam especificados em ADR e compose, sem migrations executadas |
| D03 | Redis/BullMQ **não executado**; fila em processo com mesma semântica (idempotência, backoff, DLQ em memória) | Sem Docker/Redis local; bloqueio documentado em G08 |
| D04 | pnpm via `corepack` (12.18.0) | pnpm não instalado globalmente; `packageManager` fixa a versão |
| D05 | Porta API `4181`, web `4180` (dev proxy) | Conforme sugestão do documento mestre; portas altas livres |
| D06 | Prisma schema incluído mas **não migrado** | ADR registra avaliação; execução adiada até Docker seguro |

## 4. Pendências bloqueadoras (herdadas do pacote)

- [ ] Validar recursos efetivamente disponíveis na oferta Birthub 360°.
- [ ] Aprovar preço, assinatura, trial, condições e política de negociação.
- [ ] Definir país/região e segmentos ICP iniciais e exclusões.
- [ ] Aprovar canais e modelo de consentimento, opt-out e retenção.
- [ ] Definir orçamento de IA/provedores, ferramentas de pesquisa e limites.
- [ ] Homologar os 29 modelos individuais nítidos antes da Onda 05.
- [ ] Definir responsável por aprovações e handoff de demonstração.
- [ ] **Novo:** prover Docker/Podman seguro ou Postgres local dedicado para
      ativar persistência real e BullMQ (hoje: modo mock).

## 5. Fora de escopo (reforço)

- Clone do Birthub 360°, SaaS multi-tenant, envios externos reais, pagamentos,
  contratos, scraping, APIs pagas de IA, deploy/publicação, 3D completo.
