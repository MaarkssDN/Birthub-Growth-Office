# Onda 05 — Relatório de Rigging e Animações

## O que foi entregue (verificável)
- **6 clips glTF reais por personagem**: `idle`, `listening`, `processing`,
  `speaking`, `success`, `error` — confirmado via @gltf-transform
  (`listAnimations()` retorna os 6 nomes em cada GLB).
- Canais de animação sobre nós nomeados: `Head`, `ArmL`, `ArmR`, `Body`,
  `Acc`, `bgo-char-root` (rotação/translação/escala, interpolação LINEAR,
  loop 2s).
- Runtime: `AnimationMixer` + `clipAction` por estado + **crossfade 250ms**
  (`characters.tsx` → `GlbFigure`). Fallback procedural mantém
  `AnimatedFigure` se GLB falhar.

## Limitação declarada (NÃO é rig completo)
Animação por **partes rígidas** (nós), não esqueleto com skinning —
sem deformação de malha, sem morph targets faciais, sem arquivos-fonte
Blender. Para rig esquelético real: Onda 06+ com artista/Blender.

## Movimentos por estado
- idle: respiração sutil (Body y ±0.02) + Head z ±0.04
- listening: Head y ±0.18 + braços à frente
- processing: Head y oscila ±0.5 rápido + braços levantados + Body z ±0.03
- speaking: Head nod + braços gesticulam alternado
- success: pulo duplo (root y 0→0.28) + braços acima da cabeça
- error: Body shake z ±0.08 rápido + Head tilt 0.3
