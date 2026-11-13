# Onda 04 — Evidências de Animação e Estados (G36)

## Fonte
Estados visuais dirigidos por **eventos reais** via SSE
(`/api/events/stream`) — `useOfficeEvents.ts` mapeia `eventType` →
`VisualState`. Nenhum estado é fabricado.

## Runtime de animação (`characters.tsx`)
`STATE_TUNE` por estado:

| Estado | bob | speed | pulse | shake | spin |
|---|---|---|---|---|---|
| idle | 0.03 | 2.0 | 1.0 | – | – |
| listening | 0.05 | 3.0 | 1.0 | – | – |
| processing | 0.09 | 7.0 | 1.0 | – | ✓ |
| speaking | 0.07 | 5.0 | 1.06 | – | – |
| success | 0.12 | 6.0 | 1.12 | – | – |
| error | 0.02 | 9.0 | 1.0 | ✓ | – |

`prefers-reduced-motion` zera bob/shake/spin — acessibilidade preservada.

## Prova executável (`scripts/pw-office.mjs`, 8/8 PASS)
Após "Executar missão demo", estados observados no painel:
`ocioso, atento, sucesso, sucesso, comunicando, sucesso` — mudança real
pós-eventos. Screenshot `docs/onda-03/evidencias/office-3d-pos-missao.png`.

## GLB × animação
Os GLBs atuais são malhas estáticas; a animação de estado é aplicada ao
grupo (`AnimatedFigure`) igualmente para GLB e fallback procedural —
consistência visual garantida. Clips esqueléticos ficam para Onda 05.
