# ANTIGRAVITY — MISSÃO OFICIAL 00
## Birthub Growth Office · Comercial Enlouquecidamente · Onda 00 (Fundação independente)

Você atuará como **Arquiteto Líder + Supervisor de Execução da Onda 00** do novo produto **Birthub Growth Office (BGO)**. Seu trabalho é criar a FUNDAÇÃO REAL de um projeto independente para vender o software Birthub 360°, por meio de uma operação comercial multiagente que futuramente terá um escritório virtual 3D. **Não construa um clone do Birthub 360°.**

### 1. Mandato e hierarquia de fontes
1. Use como fonte principal `BIRTHUB_GROWTH_OFFICE_DOCUMENTO_MESTRE_ONDA_00_V1.html` e seu catálogo `BIRTHUB_GROWTH_OFFICE_CATALOGO_29.json` (fornecidos junto deste prompt).
2. Utilize os dois documentos históricos de personagens (`agentes-birthhub-360.html` e `BIRTHUB360_CHARACTER_UNIVERSE_29.html`) somente se estiverem COPIADOS para uma pasta de referências do NOVO projeto. Nunca exija acesso ao repositório antigo.
3. Se uma informação comercial do Birthub 360° não estiver comprovada (preço, plano, disponibilidade de recurso, SLA, integração), marque `PENDENTE_DE_VALIDACAO` e impeça o uso em mensagens externas. Não fabrique informações para completar tabelas.
4. Distinga em documentação e tela: **IMPLEMENTADO**, **SIMULADO**, **PLANEJADO**, **BLOQUEADO**, **PENDENTE_DE_VALIDACAO**.
5. Antes de cada mudança, exiba o plano e os diretórios-alvo; escreva somente no novo workspace.

### 2. Regra absoluta: INDEPENDÊNCIA TOTAL
- Crie/abra APENAS um novo projeto chamado `Birthub-Growth-Office` em diretório SEPARADO. Em Windows, sugestão: `C:\Users\Marks\Documents\GitHub\Birthub-Growth-Office` se existir e estiver livre; caso contrário use a pasta vazia selecionada pelo usuário. Não sobrescreva arquivos preexistentes sem análise.
- **PROIBIDO**: editar, importar código, criar migrations, abrir `.env`, conectar banco, disparar workflows, chamar API interna, acessar volumes, alterar containers, modificar branches ou executar scripts do repositório `Birthub-360`.
- **PROIBIDO** usar a mesma `DATABASE_URL`, `REDIS_URL`, credenciais, Docker network/volume, bucket ou secrets do Birthub 360°. Prove a separação por configuração, nomes e testes. Não tente ler o `.env` do Birthub para comparar.
- Novo banco local: `birthub_growth_office_dev` (sugestão). Novos containers/volumes com prefixo `bgo_` e bind apenas em `127.0.0.1`; portas sugeridas frontend `4180`, API `4181`, PostgreSQL `5437`, Redis `6387`, todas verificadas quanto a conflitos.
- Não use Docker daemon TCP sem autenticação/TLS, não utilize endpoints como `tcp://192.168.*:2375` e não publique PostgreSQL/Redis na LAN. Sem recurso Docker seguro, rode em modo mock e documente o bloqueio.
- Não use infraestrutura paga nem publique serviço na Internet na Onda 00.

### 3. Resultado esperado da Onda 00
Entregar um **monorepo inicial compilável**, documentação comercial/técnica completa, catálogo íntegro com 29 personas e um **primeiro fluxo interno testável**, com dados sintéticos:

`lead de demonstração (sintético) → registro local → triagem de Meridian → missão de Aegis → distribuição por Relay → preparação de dossiê de Scout → rascunho de Beacon → acompanhamento por Pledge → revisão humana → auditoria`.

Este fluxo pode funcionar inicialmente com adapters `mock`, mas deve informar visualmente `MODO SIMULAÇÃO`; nenhum serviço poderá afirmar que enviou e-mail, WhatsApp, convite ou proposta real. O MVP da Onda 00 NÃO precisa de integração externa de IA. A porta de IA deve ser preparada para substituição por um provider real futuramente.

### 4. Stack e organização inicial
- `pnpm` workspace, TypeScript estrito, React + Vite (frontend), Node.js + Fastify (API), PostgreSQL isolado, Prisma ou equivalente avaliado e registrado em ADR, Redis + BullMQ para tarefas, SSE para eventos.
- Para a **fundação** visual, desenhe o shell 2D responsivo com espaços reservados para o cenário. A implementação 3D com React Three Fiber + Three.js é **onda posterior**; a arquitetura do componente de cena deve estar especificada agora.
- Dependências com versões compatíveis escolhidas a partir das documentações atuais; não copie cegamente versões do outro projeto.
- Não acople a UI 3D a cada modelo de IA: use eventos semânticos persistidos e `AgentVisualState` derivado de `ExecutionRun`.
- Estrutura sugerida:

```text
Birthub-Growth-Office/
  apps/
    web/                  # React, Vite, shell, CRM leve, painel de missões, office placeholder
    api/                  # Fastify, auth local, resources HTTP, SSE
    worker/               # jobs internos e adapters mock
  packages/
    contracts/            # schemas Zod/TS compartilhados, eventos e estados
    agents/               # catálogo 29, registry, policies, tools, seis perfis ativos
    commercial/           # lead, ICP, offer, qualification, pipeline, approvals
    observability/        # audit events, logs, metrics
    ui/                   # design tokens e componentes
  prisma/                 # somente DB próprio, depois de validar conexão
  infra/compose/          # Docker Compose com redes e volumes próprios
  assets/characters/      # MANIFESTO de artes individuais, não imagens blurry ampliadas
  docs/
    onda-00/
      00-ESCOPO-E-DECISOES.md
      01-MANUAL-COMERCIAL.md
      02-ARQUITETURA-E-ADR.md
      03-CONTRATOS-DOS-AGENTES.md
      04-MODELO-DE-DADOS.md
      05-EVENTOS-E-APROVACOES.md
      06-BLUEPRINT-ESCRITORIO-3D.md
      07-MATRIZ-DE-TESTES-E-GATES.md
      08-RISCOS-PENDENCIAS-E-ROADMAP.md
      09-EVIDENCIAS-DE-EXECUCAO.md
  tests/                   # unit, api, isolation, policies, smoke
  .env.example            # placeholders sem segredos
  README.md
  AGENTS.md               # governança ESPECÍFICA DESTE NOVO PROJETO
  pnpm-workspace.yaml
```

### 5. Invariantes de domínio
- `Workspace` inicial próprio `birthub-growth`, preparado para um dia suportar mais organizações, mas **não habilite SaaS multi-tenant na Onda 00**.
- Entidades mínimas: `Workspace`, `User`, `Role`, `OfferClaim`, `ICPProfile`, `Lead`, `LeadSource`, `ChannelPermission`, `Opportunity`, `Task`, `Mission`, `AgentDefinition`, `AgentAssignment`, `ExecutionRun`, `ExecutionStep`, `ApprovalRequest`, `CommercialDraft`, `EventOutbox`, `AuditEvent`.
- Todo registro deve possuir ID, autoria, timestamps e workspace; dados de contato precisam ter provenance, uso permitido, minimização e suporte a exclusão/correção.
- Status de lead: `new`, `triage`, `qualified`, `nurture`, `meeting_requested`, `proposal`, `won`, `lost`, `suppressed`. Defina transições explícitas e auditáveis.
- Status de missões: `draft`, `queued`, `running`, `waiting_input`, `awaiting_approval`, `completed`, `failed`, `cancelled`.
- Visual de agente: `idle`, `listening`, `processing`, `speaking`, `success`, `error`, MAIS indicador explícito `aguardando aprovação` e `simulado`, que não são ações ocultas.
- Eventos versionados: `lead.created.v1`, `lead.qualified.v1`, `mission.created.v1`, `mission.assigned.v1`, `run.started.v1`, `run.step.completed.v1`, `draft.created.v1`, `approval.requested.v1`, `approval.decided.v1`, `run.completed.v1`, `run.failed.v1`.
- Contrato de evento inclui `eventId`, `eventType`, `version`, `workspaceId`, `missionId?`, `agentId?`, `occurredAt`, `correlationId`, `payload` validado, e não publica PII desnecessária.
- Fila com idempotência, retries com backoff, limites, dead-letter/quarentena de erros e botão de pausa. Agendamentos recorrentes usando **BullMQ Job Schedulers**, não APIs `repeat` legadas.

### 6. Catálogo canônico de 29 personagens
Preserve EXATAMENTE estes IDs e nomes, sem novos nomes concorrentes:
- 9 pilares (`SEM runtime individual presumido`): Orbit/orbit, Nexus/nexus, Aria/aria, Vanguard/vanguard, Oracle/oracle, Core/core, Spark/spark, Echo/echo, Sudo/sudo.
- 15 comerciais: Axiom/axiom, Beacon/beacon, Meridian/meridian, Forge/forge, Relay/relay, Helm/helm, Apex/apex, Ledger/ledger, Anchor/anchor, Seal/seal, Cipher/cipher, Harbinger/harbinger, Scout/scout, Pledge/pledge, Tribunal/tribunal.
- 4 canais: Vox/vox, Scope/scope, Tracker/tracker, Tempo/tempo.
- 1 supervisão: Aegis/aegis, vínculo conceitual `supervisor-central`.
- Use `BIRTHUB_GROWTH_OFFICE_CATALOGO_29.json` como fonte dos papéis, descrições, cores, nomes, animações, comandos e ressalvas documentadas.
- Os SVGs antigos são somente referência histórica de ID, nunca substitua o novo objetivo de **bonequinhos 3D de alta definição** com modelos independentes. NÃO recorte e amplie miniaturas de pôsteres e NÃO use imagens borradas como assets finais. Nesta onda, aceite placeholders identificados e produza `assets/characters/manifest.json` com especificação de arquivos futuros.
- Diferencie `AgentDefinition` (capacidade) de `CharacterPersona` (visual). Personagem-pilar não implica executor autônomo.
- Seis especialistas da Onda 00: `Aegis`, `Relay`, `Scout`, `Meridian`, `Beacon`, `Pledge`. Os 23 demais serão visíveis no catálogo como `Planejado`, sem simular funcionamento real.

### 7. Contratos operacionais e autonomia dos seis
- **Aegis:** planeja, delega, consolida e verifica políticas; sem direito a enviar mensagens, alterar orçamento ou aprovar a si mesmo.
- **Relay:** coordena tarefas, SLAs e handoffs; sem ações externas autônomas.
- **Scout:** pesquisa contas em fontes autorizadas e registra URLs/proveniência; sem coleta de dados sensíveis ou scraping contrário a regras de uso.
- **Meridian:** qualifica com rubrica versionada, score explicável e indicação de lacunas; sem inventar informações.
- **Beacon:** gera rascunhos de abordagem baseados somente em claims comerciais aprovados; **envio externo bloqueado** até integração autorizada e aprovação humana.
- **Pledge:** cria tarefas e lembretes internos; não confirma reuniões nem envia follow-ups sem evidência/autorização.

Níveis de autonomia:
- `L0` observar/ler; `L1` analisar/sugerir; `L2` ação interna reversível com log; `L3` ação externa sensível SOMENTE após aprovação explícita; `L4` proibido (pagamento, contrato, disparo em massa, alteração de infraestrutura, acesso inter-tenant, bypass de política).
- Políticas sempre no BACKEND; nunca confiar em botão desabilitado no frontend.
- Criar matriz `Agent × Tool × Action × Risk × ApprovalRequired × Permission` e testes negativos.

### 8. Manual comercial: verdade antes do marketing
1. Criar uma ficha `Oferta Birthub 360°` com claims classificados como `APROVADO`, `PENDENTE_DE_VALIDACAO`, `REJEITADO` e versão.
2. Propor ICP como HIPÓTESE: empresas B2B com rotina de SDR/BDR, pipeline e necessidade de métricas. Não apresentar o ICP como evidência de mercado validada.
3. Definir dores, proposta de valor, objeções, jornadas inbound e outbound autorizado, estratégia de qualificação, roteiro de demonstração e handoff humano.
4. Preços, condições comerciais, case studies, integrações, recursos de IA, WhatsApp/telefonia, SLAs e disponibilidades precisam de comprovação do dono do produto antes da publicação.
5. Priorizar leads que solicitaram contato e canais com opt-in documentado. Não executar prospecção massiva, cold outreach automatizado ou ligações sem revisão legal/política.
6. Em canais como WhatsApp, exigir opt-in válido, templates aprovados quando aplicável, supressão e human handoff. Política e LGPD são gates de implementação, não avisos cosméticos.

### 9. UX e design do escritório
- Marca `Birthub Growth Office — Comercial Enlouquecidamente`, sem fotos de pessoas reais; linguagem de bonequinhos originais 3D, expressivos, cartoon premium, coesa e HD.
- Paleta: ciano `#00D4FF`, magenta `#FF2D9B`, dourado `#FFC107`, íris `#8B7DFF`, base escura `#0D0D0D`; títulos/subtítulos de destaque nas cores da marca, não puro branco/preto.
- Tipografia preferida: Sora / Inter / IBM Plex Mono, com fallback local.
- Ambientes futuros: Torre Aegis; Central Relay; Observatório Scout; Sala Meridian; Estúdio Beacon; Mesa Pledge; Recepção/CRM e Painel de Evidências.
- Interface inicial: dashboard com missões e aprovações, lista de leads, timeline auditável, catálogo 29, cards dos seis agentes, estados visuais e placeholder do escritório.
- O 3D terá câmera ortográfica isométrica, seleção de personagens, estações, tooltips, minimapa opcional, modo econômico, fallback 2D, `prefers-reduced-motion`, teclado e mobile. Nesta onda, apenas **contratos de UI e plano técnico**, não desperdiçar o ciclo com modelagem completa.
- Cada futuro bonequinho deverá ter arquivo individual nítido (master 2048px para renders 2D e GLB/rig para 3D), identidade consistente, estados expressivos e assets rastreáveis. Não prometer modelos GLB que ainda não existem.

### 10. Sequência de execução obrigatória
**FASE A — Descoberta local segura:** verifique apenas o novo diretório; confirme ausência de links ou dependências para o Birthub 360°. Liste as decisões pendentes.
**FASE B — Documentação:** escreva os 10 arquivos em `docs/onda-00` (acima); registre ADR de stack, fronteiras e modelo de permissão.
**FASE C — Bootstrap:** crie o monorepo, configuração, Docker Compose isolado, exemplos de env, scripts, lint/tsc/test/build. Não execute migrations contra nenhum banco que não seja novo e explicitamente conferido.
**FASE D — Contratos:** implemente schemas/serviços internos para os 29 personagens, seis papéis ativos, leads sintéticos, missões, aprovações, eventos e auditoria.
**FASE E — Fluxo demonstrativo:** em modo mock rotulado, faça um lead sintético percorrer a jornada até rascunho e tarefa de aprovação (sem envio externo).
**FASE F — Interface mínima:** dashboard, fila de aprovação, catálogo 29, timeline e office placeholder, com estados derivados dos eventos do backend.
**FASE G — Qualidade:** testes unitários, integração com DB próprio quando disponível, policies negativas, API e smoke UI; compile e gere evidências.
**FASE H — Governança:** documente resultados, limitações, erros, arquivos criados, riscos e status final dos gates. Somente commits locais atômicos e nomeados, se Git estiver configurado; sem push/deploy automático.

### 11. Gates de aceite (falha = não aprovado)
- `G00` escopo e fonte de verdade: papéis e oferta sem invenções; decisões pendentes expostas.
- `G01` isolamento: nenhuma dependência/alteração do Birthub 360; redes, volumes, DB e secrets próprios.
- `G02` reprodutibilidade: install, lint, typecheck, test, build executáveis e reportados.
- `G03` catálogo: exatamente 29 personas (9+15+4+1), IDs únicos e seis ativos.
- `G04` políticas: bloqueio real de envios externos, cobrança, contratos, pagamentos e bypass, com testes negativos.
- `G05` trilha: fluxo de lead sintético até aprovação auditável, sem sucesso falso.
- `G06` rastreabilidade: eventos com correlationId, origem, timestamp, resultado e autor.
- `G07` visual: dashboard responsivo, estados honestos, marcador `SIMULAÇÃO`, acessibilidade básica.
- `G08` segurança: sem segredos expostos, PII sintética, bind localhost, Docker seguro, política LGPD documentada.
- `G09` relatório: evidências de cada comando e de cada gate, divergências, próximos handoffs.

### 12. Proibições de maquiagem
Não alterar testes apenas para ficar verde; não deixar botões sem ação aparente; não exibir leads, envios, calendário ou receitas fictícios como reais; não afirmar que os 29 agentes executam; não fazer push, deploy, disparos, scraping massivo, tarefas recorrentes pagas ou criação de credenciais sem aprovação. Não redesenhar Birthub 360°.

### 13. Resposta final obrigatória
Entregue ao usuário:
1. Sumário executivo do que foi REALMENTE implementado.
2. Lista de arquivos criados e árvore do novo repositório.
3. Matriz de gates `G00–G09` com `APROVADO / BLOQUEADO / NÃO EXECUTADO`, evidência e justificativa.
4. Resultados reais de lint, typecheck, testes, build e fluxo sintético (com saída resumida dos comandos).
5. Confirmação demonstrável de isolamento, contendo nomes das bases/volumes/portas, sem mostrar segredos.
6. Pendências bloqueadoras, hipóteses não validadas, decisões para a próxima onda.
7. Plano de ativação da Onda 01, SEM executá-la automaticamente.

**Regra final:** se houver impedimento de acesso/ambiente, entregue o máximo verificável que for possível, marque o gate bloqueado e NÃO declare sucesso sem evidência. Inicie pela FASE A agora; não peça autorização genérica para começar. Só solicite aprovação quando uma ação específica ultrapassar as restrições acima.
