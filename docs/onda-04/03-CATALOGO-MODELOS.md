# Onda 04 — Catálogo Técnico dos Seis Modelos (G35)

## Formato e localização
`apps/web/public/assets/characters/glb/<agentId>.glb` — binário glTF 2.0
(magic `glTF` verificado), servido estaticamente pelo Vite em
`/assets/characters/glb/<id>.glb`.

## Inventário (gerado por `apps/web/scripts/build-glbs.ts`)

| Agente | Arquivo | Tamanho | Meshes | Acessório-chave |
|---|---|---|---|---|
| Aegis | aegis.glb | ~170 KB | 31 | coroa + manto + gema íris |
| Relay | relay.glb | ~176 KB | 29 | headset LED + crachá |
| Scout | scout.glb | ~181 KB | 28 | fedora + lupa |
| Meridian | meridian.glb | ~178 KB | 32 | óculos + prancheta |
| Beacon | beacon.glb | ~173 KB | 28 | antena + megafone + raio |
| Pledge | pledge.glb | ~172 KB | 29 | relógio + agenda |

Total ~1,05 MB para os seis — carregamento sob demanda por `useGLTF`
(cada arquivo só é baixado quando o agente monta na cena).

## Materiais
`MeshStandardMaterial` → glTF metallic-roughness:
baseColorFactor (sRGB→linear), metallicFactor, roughnessFactor,
emissiveFactor. **Ressalva**: `KHR_materials_emissive_strength` não é
extensão core — intensidades >1 foram saturadas em 1 no export.

## Limitações declaradas (honesto)
- **Sem rig/esqueleto e sem clips de animação** — são malhas estáticas.
  Os estados visuais são aplicados por transformação do grupo inteiro
  (bob/shake/tilt), não por animação facial/esquelética.
- Geometria procedural em primitivas — qualidade "protótipo expressivo",
  **não** é o modelo de arte final homologado. Para arte final: modelar
  em Blender → rig → clips `idle|listening|processing|speaking|success|
  error` → export GLB → substituir arquivo no mesmo path (contrato já
  implementado no loader).
- Texturas: nenhuma (materiais flat/PBR). UVs não exportadas.

## Contrato de animações futuras
Nomes de clip obrigatórios (iguais aos `VISUAL_STATES`):
`idle`, `listening`, `processing`, `speaking`, `success`, `error`.
O loader atual ignora clips; quando existirem, o wrapper
`AnimatedFigure` deve delegar ao `AnimationMixer` por nome.
