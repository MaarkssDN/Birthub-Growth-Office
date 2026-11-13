# Onda 05 — Auditoria Inicial

- Branch `feat/onda-05` criada de `main` @673666b (21 commits, worktree limpa).
- Baseline: 73/73 testes, lint 0, typecheck 10/10, build OK (Onda 04).
- GLBs Onda 04: 6 arquivos ~170KB, malhas estáticas SEM rig/clips.
- `characterModel.ts` já centralizava a geometria (runtime + export).
- **Blender NÃO instalado**; sem artista 3D no ambiente. Decisão: produzir
  GLBs com **animação por nós rígidos + clips glTF reais** via pipeline
  programático — honesto: NÃO é rig esquelético/deformação.
