# Onda 11 — Homologação Visual Playwright

## 1. Escopo da Homologação
A Onda 10 introduziu telas da Central Scout e Custos de IA sem uma suíte Playwright dedicada. A Onda 11 corrigiu essa lacuna com a implementação do script de teste end-to-end automatizado `scripts/pw-onda11.mjs`.

## 2. Configurações dos Testes
- **Stack Real Executando:**
  - API: `http://127.0.0.1:4181` (Fastify, PostgreSQL 17 nativo, Memurai Redis)
  - Web: `http://127.0.0.1:4180` (Vite, React 19, Three.js)
- **Dispositivos e Viewports:**
  - Desktop: 1440 × 900
  - Mobile: 390 × 844 (iPhone 14 / Viewport Mobile Moderno)
- **Critérios de Qualidade Verificados:**
  - Zero erros no console (`pageerror`).
  - Zero transbordamento horizontal (`scrollWidth <= clientWidth`).
  - Renderização completa de elementos críticos e interações reais.

## 3. Resumo dos Resultados

```json
{
  "totalChecks": 35,
  "passed": 35,
  "failed": 0,
  "screenshotsCount": 16,
  "desktopStatus": "PASSED (18/18)",
  "mobileStatus": "PASSED (17/17)"
}
```

## 4. Detalhamento dos Testes Executados

### 4.1 Central Scout
- [x] Importação de CSV válido via multipart (`desktop-scout-imported.png`, `mobile-scout-imported.png`).
- [x] Tratamento de arquivo inválido e validações de cabeçalho.
- [x] Deduplicação idempotente ao reimportar o mesmo CSV.
- [x] Listagem com paginação e busca textual (`q`).
- [x] Filtros por UF, status de revisão e score mínimo.
- [x] Abertura do Dossiê individual de empresa (`desktop-scout-dossier.png`, `mobile-scout-dossier.png`).
- [x] Ações de aprovação e rejeição de empresas com justificativa.
- [x] Ação explícita "Criar oportunidade comercial" com idempotência garantida (`desktop-scout-opportunity-created.png`).

### 4.2 Custos IA
- [x] Exibição de histórico de inferências (`desktop-costs.png`, `mobile-costs.png`).
- [x] Diferenciação visual e semântica entre custos reais e simulados (`simulated: true`).
- [x] Filtros por missão, agente e provedor.
- [x] Exibição de limites de orçamento diário e mensal com barras de consumo.
- [x] Formulário de registro de tarifas vigentes.

### 4.3 Pipeline Comercial
- [x] Exibição dos cards de funil com contadores por estágio (`desktop-pipeline-funnel.png`, `mobile-pipeline-funnel.png`).
- [x] Fila de empresas aprovadas aguardando oportunidade.
- [x] Tabela de oportunidades com ordenação por prioridade e score.
- [x] Drawer de detalhes com histórico e evidências (`desktop-pipeline-drawer.png`, `mobile-pipeline-drawer.png`).
- [x] Transição de estágio comercial com seleção dinâmica de próximos estágios válidos e justificativa obrigatória (`desktop-pipeline-transition.png`, `mobile-pipeline-transition.png`).

### 4.4 Central de Aprovações
- [x] Fila de solicitações de supervisão humana (`desktop-approvals.png`, `mobile-approvals.png`).
- [x] Filtros por status (`pending`, `approved`, `rejected`) e por ação (`company.promote_opportunity`, `opportunity.outreach_review`, etc.).
- [x] Fluxo de deferimento e indeferimento de solicitações com justificativa.

### 4.5 Escritório 3D
- [x] Canvas Three.js inicializado com 6 agentes animados (`desktop-office.png`, `mobile-office.png`).
- [x] Seleção individual do agente Scout exibindo dossiê no painel contextual.
- [x] Painel comercial ao vivo conectado aos eventos SSE (`opportunity.*`).
- [x] Responsividade no layout mobile sem sobreposição indevida do canvas.
