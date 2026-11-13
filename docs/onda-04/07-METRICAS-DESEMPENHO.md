# Onda 04 — Métricas de Desempenho (G35/G38)

## Assets 3D
| Métrica | Valor |
|---|---|
| GLBs | 6 arquivos, ~170–181 KB cada (~1,05 MB total) |
| Malhas por personagem | 28–32 |
| Texturas | 0 (materiais flat PBR) |
| Carregamento | sob demanda via `useGLTF` + Suspense |
| Bundle web | 1.101 kB JS (gzip 308 kB) — warning >500 kB, candidato a code-split |
| DPR | cap `[1, 1.75]` |

## Runtime
- `AnimatedFigure`: `useFrame` por personagem — custo O(6) grupos, sem
  alocação por frame.
- `useGLTF` cacheia por URL — cada GLB baixado 1× por sessão.
- Fallback procedural montado apenas se GLB falhar (ErrorBoundary).

## Evidência Playwright (`scripts/pw-glb.mjs` — 11/11 PASS)
- 6/6 GLBs HTTP 200 em `/assets/characters/glb/`.
- Canvas WebGL renderizado, 6 agentes, mobile sem overflow.
- Screenshots: `personagem-{aegis,relay,scout,meridian,beacon,pledge}.png`,
  `escritorio-glb-geral.png`, `escritorio-glb-mobile.png` em `evidencias/`.

## Ressalvas
- Sem medição de FPS formal — cena leve (malhas baixas) mas sem benchmark;
  registrar como "não verificado" para dispositivos Android reais.
- GLBs sem compressão (Draco/meshopt) — ~1 MB total é aceitável; se o
  catálogo crescer, avaliar `gltf-transform` optimize.
