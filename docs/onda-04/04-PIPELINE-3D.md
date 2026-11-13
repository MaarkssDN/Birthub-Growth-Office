# Onda 04 — Pipeline de Produção 3D (FASE 04)

## Pipeline executado nesta onda
```
characterModel.ts (three.js puro)
   ├─ characters.tsx (runtime React: animação de estado + seleção)
   └─ scripts/build-glbs.ts (Node + @gltf-transform/core)
        → apps/web/public/assets/characters/glb/<id>.glb
   → characters.tsx: useGLTF + Suspense + ErrorBoundary
     (fallback procedural automático se GLB faltar/falhar)
```

## Etapas do pipeline completo (status)

| Etapa | Status |
|---|---|
| 1. Modelagem individual | ✅ procedural paramétrico (6 modelos únicos) |
| 2. Materiais/texturas | ⚠️ materiais PBR flat; sem texturas |
| 3. Rigging | ⛔ pendente (Onda 05 — Blender/arte) |
| 4. Animações | ⚠️ movimento de grupo por estado; sem clips |
| 5. Exportação GLB | ✅ `build-glbs.ts` reproduzível (`pnpm --filter @bgo/web exec tsx scripts/build-glbs.ts`) |
| 6. Otimização | ✅ ~1,05 MB total, malhas baixas, dpr cap 1.75 |
| 7. Integração R3F | ✅ `useGLTF` + fallback automático |
| 8. Homologação visual | ⚠️ screenshots gerados; aprovação de arte pendente |

## Regeneração
Qualquer edição em `characterModel.ts` exige re-rodar `build-glbs.ts`
para atualizar os GLBs — o script é determinístico.

## Para modelos finais (Onda 05+)
1. Modelar em Blender/especialista → export `.glb` com rig.
2. Clips obrigatórios: `idle|listening|processing|speaking|success|error`.
3. Substituir `apps/web/public/assets/characters/glb/<id>.glb` —
   nenhum código muda (mesmo path/contrato).
4. Adicionar `AnimationMixer` em `characters.tsx` quando clips existirem.
