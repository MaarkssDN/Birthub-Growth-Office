# Onda 05 — Matriz de Homologação

| Item | Status | Evidência |
|---|---|---|
| 6 GLBs individuais | ✅ | arquivos válidos, magic glTF, 6/6 HTTP 200 |
| Modelos visualmente distintos | ✅ | acessórios/cores/silhuetas únicos |
| Rigging esquelético | ⛔ NÃO ENTREGUE | animação por nós rígidos (declarado) |
| 6 animações reais | ✅ | clips glTF verificados + mixer no runtime |
| Arquivos-fonte editáveis | ⚠️ PARCIAL | characterModel.ts paramétrico; sem .blend |
| Texturas HD | ⛔ | materiais flat, sem texturas |
| Retratos HD | ⚠️ | screenshots Playwright por personagem |
| Transições suaves | ✅ | crossfade 250ms |
| Eventos reais | ✅ | estados via SSE, sem fabricação |
| Mobile | ✅ | sem overflow, canvas/fallback |
| Lint/typecheck/testes/build | ✅ | 0/10/73/build OK |
| Zero regressão comercial | ✅ | pw-visual 11/11, fluxo intacto |
| Zero deps Birthub 360° | ✅ | isolation test |

Veredito: frente visual AVANÇOU com animações reais; rig esquelético,
texturas e arte final permanecem para Onda 06 (precisa Blender/artista).
