# Evidências de Execução dos Seis Agentes — Onda 13
## Orquestração Comercial Cooperativa e Trilha de Auditoria (G175)

### 1. Papel dos Seis Agentes Ativos na Missão Comercial

A missão comercial de prospecção supervisionada é executada através da colaboração coordenada dos seis agentes do monorepo, cada um com autonomia delimitada por contrato:

| Agente | Camada | Papel na Missão Comercial | Ações e Ferramentas Auditadas |
|---|---|---|---|
| **Aegis** | L0 | Supervisor Central e Validador de Políticas | Criação e planejamento da missão comercial; verificação de limites de autonomia e orçamento de IA. |
| **Relay** | L1 | Coordenador de Pipeline e Dependências | Sequenciamento das etapas comerciais; transição de estágios da oportunidade; emissão de eventos de coordenação. |
| **Scout** | L2 | Investigação e Inteligência de Empresas | Resolução cadastral da empresa e enquadramento de CNAE/porte; consolidação do dossiê inicial. |
| **Meridian** | L2 | Qualificação SDR e Análise de ICP | Avaliação de aderência contra o ICP versionado; geração do diagnóstico estruturado (Fatos/Inferências/Recomendações). |
| **Beacon** | L2 | Elaboração da Abordagem Comercial | Redação do rascunho executivo com vinculação obrigatória de alegações aprovadas do catálogo. |
| **Pledge** | L2 | Compromissos, Trilha e Agendamento | Registro de prazos de acompanhamento; submissão da aprovação humana obrigatória; garantia de não envio externo. |

---

### 2. Trilha de Execução e Correlação Ponta a Ponta

Para cada missão executada (ex.: onboarding de lead ou promoção de empresa), um `correlationId` UUIDv4 exclusivo acompanha todas as etapas:
1. `mission.created.v1` — Aegis cria a missão com meta e identificador de correlação.
2. `opportunity.stage_changed.v1` — Relay transiciona de `approved_target` para `researching`.
3. `run.started.v1` / `run.completed.v1` — Scout investiga e valida a empresa.
4. `opportunity.stage_changed.v1` — Relay transiciona para `qualifying`.
5. `run.started.v1` / `run.completed.v1` — Meridian gera diagnóstico estruturado.
6. `opportunity.stage_changed.v1` — Relay transiciona para `qualified` e em seguida `outreach_drafted`.
7. `run.started.v1` / `run.completed.v1` — Beacon elabora rascunho com alegações homologadas.
8. `opportunity.stage_changed.v1` — Relay move oportunidade para `awaiting_approval`.
9. `approval.requested.v1` — Pledge submete requisição de aprovação com preview completo.
10. `run.started.v1` / `run.completed.v1` — Pledge consolida os compromissos pendentes.

---

### 3. Registro de Custos e Duração por Agente

Exemplo de telemetria consolidada registrada para a missão dos 6 agentes:
- **Duração Total da Missão**: ~1.250 ms (em modo determinístico/simulado local).
- **Custo Total de Execução**: 0.03 unidades.
- **Runs Auditados no Banco**: 6 registros de execução append-only com `status = completed`.
- **Eventos Outbox Gerados**: 12 eventos de domínio enfileirados e processados pelo `OutboxPublisher`.
