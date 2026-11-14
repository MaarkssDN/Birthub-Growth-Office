# Relatório de Evidências Visuais Playwright — Onda 13
## Homologação Visual Desktop e Mobile (G182)

### 1. Parâmetros de Execução dos Testes E2E
- **Harness**: Playwright Core com Chromium Headless
- **Data da Execução**: 2026-11-14T04:27:12.077Z
- **Endpoints Validados**:
  - Web UI: `http://127.0.0.1:4180`
  - Backend API: `http://127.0.0.1:4181`
- **Total de Screenshots Capturadas**: **16 de 16 (100% de sucesso)**
- **Erros de Página (Console/Runtime)**: **0 erros**

---

### 2. Inventário de Capturas — Desktop (1440x900)

| Arquivo | Visão / Módulo | Descrição da Evidência | Status |
|---|---|---|---|
| `01-dashboard-desktop.png` | Dashboard Geral | Visão panorâmica do Growth Office com status dos 6 agentes e métricas iniciais. | **PASS** |
| `02-prontidao-comercial-desktop.png` | Prontidão Comercial | Checklist das 9 dimensões da oferta comercial, score de 100% e alegações bloqueadas. | **PASS** |
| `03-ficha-consolidada-desktop.png` | Ficha Consolidada | Dossiê comercial integrado com separação de fatos, inferências e rascunho do Beacon. | **PASS** |
| `04-metricas-piloto-desktop.png` | Métricas do Piloto | Painel de KPIs de aquisição com 0 reuniões realizadas (`absent`) e honesty badge. | **PASS** |
| `05-pipeline-comercial-desktop.png` | Pipeline Comercial | Kanban comercial exibindo a oportunidade em estágio `awaiting_approval`. | **PASS** |
| `06-scout-desktop.png` | Central Scout | Lista de empresas importadas e qualificadas com pontuação de aderência. | **PASS** |
| `07-aprovacoes-desktop.png` | Central de Aprovações | Painel de decisão do operador humano com segregação de funções. | **PASS** |
| `08-escritorio-3d-desktop.png` | Escritório 3D | Renderização WebGL interativa dos 6 personagens com seus respectivos estados operacionais. | **PASS** |

---

### 3. Inventário de Capturas — Mobile (390x844 / iPhone 14)

| Arquivo | Visão / Módulo | Descrição da Evidência | Status |
|---|---|---|---|
| `01-dashboard-mobile.png` | Dashboard Mobile | Layout responsivo do dashboard em dispositivo móvel com navegação adaptativa. | **PASS** |
| `02-prontidao-comercial-mobile.png` | Prontidão Comercial Mobile | Cards verticais das 9 categorias com status e links de evidência documental. | **PASS** |
| `03-ficha-consolidada-mobile.png` | Ficha Consolidada Mobile | Visualização do dossiê integrado adaptada para tela vertical de smartphone. | **PASS** |
| `04-metricas-piloto-mobile.png` | Métricas do Piloto Mobile | Grid responsivo de indicadores de aquisição de clientes. | **PASS** |
| `05-pipeline-comercial-mobile.png` | Pipeline Mobile | Visualização do funil e cartões de oportunidade em viewport mobile. | **PASS** |
| `06-scout-mobile.png` | Scout Mobile | Listagem de empresas e ações de qualificação em tela pequena. | **PASS** |
| `07-aprovacoes-mobile.png` | Central de Aprovações Mobile | Ações de homologação humana com botões otimizados para toque. | **PASS** |
| `08-escritorio-3d-mobile.png` | Escritório 3D Mobile | Cena tridimensional renderizada responsivamente com controles orbitais móveis. | **PASS** |

---

### 4. Localização dos Artefatos
Todos os arquivos binários `.png` foram gerados e salvos de forma atômica no diretório local:
`docs/onda-13/evidencias/`
