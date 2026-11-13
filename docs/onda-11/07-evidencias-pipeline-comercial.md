# Onda 11 — Evidências do Pipeline Comercial Visual

## 1. Interface Unificada do Pipeline
A interface `PipelineView` foi adicionada à aplicação web (`apps/web/src/scout.tsx` e `apps/web/src/App.tsx`) integrando:
1. **Métricas de Funil**: Contadores dinâmicos por estágio (`new`, `qualified`, `followup_planned`, `proposal_pending`, `negotiation`, `won`, `lost`).
2. **Fila de Empresas Aprovadas**: Seção destacada exibindo empresas validadas na Central Scout que ainda não foram convertidas em oportunidades, com botão de ação direta.
3. **Tabela de Oportunidades**:
   - Filtros por estágio comercial, agente responsável, prioridade e busca textual livre.
   - Colunas com pontuação de aderência ao ICP, prioridade com cores semânticas, próxima ação planejada e data limite.
4. **Gaveta de Detalhes da Oportunidade**:
   - Vínculo direto de proveniência (empresa, lote de origem, dossiê, correlationId).
   - Card de evidências de ICP (razões de pontuação e lacunas detectadas).
   - Acionamento da missão integrada dos 6 agentes (Aegis, Relay, Scout, Meridian, Beacon, Pledge).
   - Visualização dos passos da missão e minuta gerada pelo Beacon (com destaque de claims aprovados e alerta de bloqueio de envio externo).
   - Seletor de transição de estágio com validação dinâmica de transições permitidas e obrigatoriedade de justificativa textual.
   - Histórico cronológico de movimentações (`OpportunityHistory`).

## 2. Capturas de Tela Playwright
As telas foram homologadas em viewport Desktop (1440x900) e Mobile (390x844):
- `docs/onda-11/evidencias/desktop-pipeline-funnel.png`: Visão geral do funil e empresas aprovadas.
- `docs/onda-11/evidencias/desktop-pipeline-drawer.png`: Drawer com detalhes, missão dos 6 agentes e minuta de prospecção.
- `docs/onda-11/evidencias/mobile-pipeline-funnel.png`: Responsividade da visualização em dispositivos móveis.
- `docs/onda-11/evidencias/mobile-pipeline-drawer.png`: Drawer adaptado para tela vertical de 390px.
