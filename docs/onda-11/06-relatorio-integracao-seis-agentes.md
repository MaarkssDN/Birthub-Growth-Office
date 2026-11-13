# Onda 11 — Relatório de Integração dos Seis Agentes

## 1. Escopo da Orquestração Comercial
A Onda 11 conecta a oportunidade criada na Central Scout aos 6 agentes ativos do Birthub Growth Office em um fluxo cooperativo, estruturado e supervisionado.

## 2. Papéis dos Seis Agentes na Missão Comercial

1. **AEGIS (Supervisor Central)**:
   - Recebe a solicitação de prospecção e autoriza a abertura da missão (`mission.started`).
   - Monitora limites operacionais e conformidade regulatória.
   - Designa RELAY para coordenação tática.

2. **RELAY (Coordenador Comercial)**:
   - Orquestra as etapas de trabalho, gerencia dependências e despacha tarefas.
   - Assegura que nenhum agente subsequente atue antes da entrega do anterior.

3. **SCOUT (Investigação de Contas)**:
   - Recupera o dossiê da empresa, os dados cadastrais (CNPJ, razão social, setor, CNAE, porte) e o lote CSV de origem.
   - Consolida as evidências preliminares levantadas.

4. **MERIDIAN (Qualificação SDR)**:
   - Avalia a aderência ao Perfil de Cliente Ideal (ICP).
   - Identifica gaps de informação (ex: stack de tecnologia, volume de vendas, presença digital).
   - Define o estágio comercial (`qualified` ou `nurture`) de forma determinística/regras heurísticas na ausência de IA externa autenticada.

5. **BEACON (Prospecção Outbound)**:
   - Redige a minuta da abordagem comercial personalizada.
   - **Regra Inviolável**: Utiliza unicamente alegações comerciais (`OfferClaim`) aprovadas pelo time de produto.
   - **Regra Inviolável**: Não realiza envio externo (`channel.send` bloqueado pelo policy engine). A mensagem é gerada estritamente como rascunho (`draft`).

6. **PLEDGE (Compromissos e Follow-up)**:
   - Estrutura o plano de próximos passos com responsáveis e prazos.
   - Registra as tarefas na oportunidade (`nextAction`, `nextActionDueAt`) e solicita aprovação humana quando houver atividade externa planejada.

## 3. Rastreabilidade da Execução
Toda execução do motor `runOpportunityMission`:
- Gera um `missionId` persistido no banco com status `completed`.
- Registra passos individuais com tempos de execução (`ms`), status e saídas estruturadas.
- Emite eventos de auditoria: `opportunity.mission_started.v1`, `opportunity.stage_changed.v1`, `opportunity.priority_changed.v1`.
- Atualiza o registro da oportunidade no PostgreSQL com o agente responsável e o `currentMissionId`.
- Alimenta os eventos do Escritório 3D via SSE (`/api/events/stream`), refletindo o estado ativo dos agentes.
