# Onda 05 — Backlog

1. **Arte final dos 6 personagens**: modelagem Blender → rig → clips
   `idle|listening|processing|speaking|success|error` → substituir GLBs
   em `apps/web/public/assets/characters/glb/` (contrato já pronto).
2. **AnimationMixer** em `characters.tsx` quando clips existirem.
3. **G33 — IA real**: credencial autorizada → `BGO_AI_MODE=real` +
   `BGO_AI_ENABLED=1` + `BGO_AI_API_KEY`; avaliar saídas reais do Meridian;
   estender diagnose para scout/beacon/pledge.
4. **Outbox publisher assíncrono** dedicado (hoje síncrono no emit).
5. **Métricas de custo de IA** por missão (tokens/custo reais).
6. **RBAC granular por agente** no escritório.
7. **Code-split do bundle web** (1,1 MB — warning vite).
8. **Compressão de malha** (Draco/meshopt) se catálogo crescer.
9. **FPS benchmark** em Android real.
10. **Checkpoints de cancelamento** dentro do `runDemoFlow` (handler
    hoje é atômico; ctx.isCancelled existe mas não é consultado no fluxo).
