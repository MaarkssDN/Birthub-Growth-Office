# BGO · Onda 00 — Blueprint do Escritório 3D (especificação, não implementação)

## 1. Escopo desta onda

Apenas **contratos de UI + plano técnico**. O frontend entrega shell 2D
responsivo com placeholder do escritório. React Three Fiber + Three.js ficam
para a Onda 05. Nenhum GLB é prometido ou produzido.

## 2. Arquitetura do componente de cena (contrato futuro)

```
<OfficeScene>                      // apps/web/src/office/
  ├─ <SceneCanvas>                 // lazy-loaded; só monta se WebGL ok
  │    ├─ OrthographicCamera (isométrica fixa)
  │    ├─ <StationLayer>           // 6 estações nomeadas
  │    ├─ <CharacterLayer>         // 1 GLB por personagem, LOD
  │    ├─ <Minimap> (opcional)
  │    └─ <Fallback2D>             // se prefers-reduced-motion | sem WebGL
  ├─ useAgentVisualState()         // deriva de ExecutionRun via SSE/REST
  └─ <AgentInspector>              // tooltip, ficha, timeline do agente
```

Regras de acoplamento:
- Cena consome **somente** `AgentVisualState` + eventos semânticos.
- Nenhum modelo de IA, provider ou endpoint comercial é importado pela cena.
- Troca de provider de IA não pode exigir rebuild da cena.

## 3. Estados visuais

`idle, listening, processing, speaking, success, error` mapeados de
`ExecutionRun.status`:

| Run status | Visual |
|------------|--------|
| queued/draft | idle |
| running (input) | listening |
| running (step) | processing |
| completed | success (pulso curto → idle) |
| failed | error |
| awaiting_approval | processing + badge "aguardando aprovação" |
| qualquer com mock=true | overlay "SIMULAÇÃO" persistente |

`prefers-reduced-motion` → sem animações, transições instantâneas.

## 4. As seis estações (Onda 05)

| # | Agente | Estação | Função visual |
|---|--------|---------|----------------|
| 1 | Aegis | Torre de Controle | missões, política, custo, aprovações |
| 2 | Relay | Central de Orquestração | fila, distribuição, prazos |
| 3 | Scout | Observatório de Mercado | mapas, sinais, dossiês |
| 4 | Meridian | Sala de Qualificação | scoring, perguntas |
| 5 | Beacon | Estúdio de Abordagem | rascunhos, templates |
| 6 | Pledge | Mesa de Compromissos | pendências, retornos |

+ Recepção/CRM e Painel de Evidências (UI, não estações de agente).

## 5. Padrão de arte (obrigatório p/ produção)

- Bonequinhos 3D originais, cartoon premium, proporcionados, expressivos.
- Por personagem: master ≥2048px (renders 2D), GLB+rig (3D), 3 cores de paleta,
  objeto/roupa do papel, 5+ expressões, variantes de estado.
- Proibido: recorte de pôster, upscale de baixa resolução, foto humana,
  personagens de franquias, "HD" sem inspeção de nitidez.
- `assets/characters/manifest.json` registra spec de cada arquivo futuro com
  `status: PLANEJADO` — nenhum asset final existe na W00.
- Homologação individual de nitidez é gate da Onda 05.

## 6. Performance e acessibilidade

- Câmera ortográfica isométrica; LOD; lazy load de estações fora do frustum.
- Modo econômico (sem sombras/partículas); fallback 2D completo.
- Teclado: selecionar estação/agente, abrir inspetor; aria-live em mudanças
  de estado; mobile: lista de estações em vez de cena 3D.
- Orçamento: <16ms/frame alvo em GPU integrada; medir na Onda 05.

## 7. Ordem de ondas (reforço)

W00 fundação → W05 cenário/animais → W06 escala p/ 29 personagens.
Persona visual ≠ executor: pilares nunca recebem `agentId` de runtime.
