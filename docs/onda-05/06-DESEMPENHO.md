# Onda 05 — Desempenho

- GLBs: ~180-191 KB cada (~1,1 MB total), malhas 28-32, sem texturas.
- Animação: AnimationMixer update O(tracks) por frame — custo ínfimo.
- DPR cap 1.75; code-split do bundle segue pendente (warning vite ~1,1MB).
- Sem benchmark FPS formal em Android real — "não verificado".
