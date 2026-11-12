# Onda 03 — Blueprint Técnico do Escritório 3D (FASE 05)

## Stack
React 18 + TypeScript + Vite · Three.js + @react-three/fiber + @react-three/drei
· OrbitControls (pan/zoom/orbit) · câmera isométrica (~40°)

## Arquivos
- `apps/web/src/office/OfficeView.tsx` — layout: cena + painel lateral
  (agentes, estado, estação, eventos recentes) + botão "Executar missão
  demo" + badge SIMULAÇÃO.
- `apps/web/src/office/Office3D.tsx` — cena: 7 zonas (6 estações + núcleo
  de resultados), mesas, monitores, iluminação, labels.
- `apps/web/src/office/characters.tsx` — bonequinhos procedurais.
- `apps/web/src/office/useOfficeEvents.ts` — SSE `/api/events/stream` +
  replay `/api/events` → estados por agente.
- `apps/web/src/hooks.ts` — `useAsync` compartilhado.

## Zonas → agentes
| Zona | Agente | Papel |
|---|---|---|
| Sala do Supervisor | Aegis | delegar, aprovar |
| Coordenação | Relay | organizar fluxos |
| Inteligência | Scout | dossiês de conta |
| Qualificação | Meridian | analisar leads |
| Prospecção | Beacon | rascunhos |
| Follow-up | Pledge | compromissos |
| Núcleo central | — | resultados em tempo real |

## Estados visuais
`VISUAL_STATES` do contrato mapeados de eventos reais:
`*.started/queued` → processing · `*.ready/completed` → success ·
`*.failed/error/blocked` → error · `action.requested` → speaking ·
`default` → idle. Sem animação de sucesso sem evento de conclusão.

## Acessibilidade
- Fallback não-3D (painel + lista de agentes) se WebGL indisponível.
- Botão "reduzir animações" → remove `Float`/`IdleBob`.
- Layout mobile: canvas full-width + painel empilhado; sem scroll
  horizontal (verificado).
