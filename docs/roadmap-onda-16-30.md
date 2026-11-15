# Roadmap — Ondas 16 a 30

Planejamento de continuidade do Birthub Growth Office após a Onda 15
(`agentTask` supervisionado + sandbox UI). Cada onda deve seguir o padrão
estabelecido: branch `feat/onda-XX`, commits atômicos, docs em `docs/onda-XX/`,
gates com evidência executável, sem push/deploy sem autorização explícita.

Princípios que valem para todas as ondas:

- `AGENTS.md` é lei: isolamento `bgo_*`, loopback, sem envio externo real,
  sem PII real, claims aprovados antes de uso comercial, honestidade de estado.
- Nenhuma onda pode rebaixar gates já homologados (regressão = bloqueio).
- IA real só com credencial autorizada; sem ela, SIMULADO visível.
- Toda mutação relevante: evento versionado + AuditEvent + correlationId.

---

## ONDA 16 — IA dentro do pipeline de missões

**Objetivo:** tirar o `agentTask` do modo manual e embuti-lo na jornada
comercial orquestrada pelo Relay.

- Scout/Beacon/Pledge chamam `agentTask` dentro de steps de missão (não só via API manual).
- Prompts dedicados e versionados por agente e por tipo de missão.
- Fallback determinístico/SIMULADO quando provider indisponível — nunca finge real.
- Saída estruturada alimenta `MissionResult` e aparece no escritório 3D.
- Homologação E2E: CSV → IA qualifica → rascunho Beacon → Pledge → fila de revisão.
- Gates: agentTask executado por step persistido; `simulated` correto por provider;
  zero regressão; Playwright da jornada.

## ONDA 17 — Inteligência semântica e benchmark de providers

**Objetivo:** qualidade de matching sem custo e decisão de router por evidência.

- Embeddings locais via Ollama (`nomic-embed-text` ou equivalente):
  ICP semântico, dedup fuzzy de empresas, similaridade dossiê↔oferta.
- Cache de embeddings persistido (pgvector ou tabela própria — decisão em ADR).
- Benchmark: mesmo dossiê sintético em todos os providers configurados;
  relatório custo/latência/schema-validity/qualidade.
- Router passa a usar scores do benchmark (ainda com prioridade manual acima).
- Gates: embeddings 100% locais e gratuitos; benchmark reproduzível e auditado;
  nenhuma chamada paga sem autorização.

## ONDA 18 — Primeiro piloto com inferência real (condicional)

**Objetivo:** primeira execução real auditada end-to-end, se houver credencial
free-tier autorizada (Groq/Gemini/OpenRouter/Cloudflare).

- Checklist de autorização: origem da chave, termos do tier, dados permitidos.
- 1 missão real completa com budget cap, correlationId e relatório de custo real.
- Comparação real vs. simulado no mesmo input (diff de saída documentado).
- Se sem credencial: onda vira hardening — métricas de host (CPU/RAM/latência
  Ollama), rate-limit por agente, alertas de orçamento proativos.
- Gates: `simulated=false` comprovado em usage record + audit; custo real
  registrado; nenhuma PII real enviada.

## ONDA 19 — Cadência comercial supervisionada

**Objetivo:** o Pledge deixa de sugerir e passa a operar cadências com gate humano.

- Agendador de follow-ups (BullMQ delayed jobs) com política de janela/quiet hours.
- Estados de cadência por oportunidade: `pending → drafted → approved → scheduled`.
- Supressão/opt-out propagada para qualquer rascunho futuro.
- Relatório de cadência por semana para o operador.
- Gates: nenhum draft sai sem `approved`; opt-out bloqueia até rascunho;
  jobs sobrevivem a restart (já coberto por BullMQ persistente — provar).

## ONDA 20 — Relacionamento e LGPD operacional

**Objetivo:** base de relacionamento auditável com direitos do titular completos.

- Timeline de interações por lead/oportunidade (importado, contatado, respondeu, opt-out).
- Endpoints de titular: exportar dados, corrigir, excluir (anonimização preservando auditoria).
- Registro de consentimento por canal com provenance.
- Retenção configurável por tipo de dado; purge auditado.
- Gates: exclusão LGPD executável e testada; consentimento exigido antes de qualquer
  contato futuro; auditoria append-only preservada após anonimização.

## ONDA 21 — Analytics comercial

**Objetivo:** o operador enxerga o funil inteiro, não só filas.

- Dashboard de funil: importadas → revisadas → aprovadas → promovidas → contatadas → respondidas.
- Métricas por origem (CSV, portal, manual), por agente, por provider de IA.
- Cohort semanal de promoções; tempo médio por estágio.
- Exportação de relatório executivo (PDF/CSV) com marca SIMULADO onde aplicável.
- Gates: números reconciliam com tabelas-fonte (teste de consistência);
  nenhuma métrica inventada; simulado nunca soma com real.

## ONDA 22 — Multi-workspace e RBAC granular

**Objetivo:** suportar mais de um workspace/tenant sem vazamento.

- Isolamento `workspaceId` auditado em todas as rotas e stores (teste de cross-tenant).
- Papéis: `operator`, `reviewer`, `admin`, `auditor` (read-only).
- Auditoria por usuário em toda mutação (já parcial — completar).
- Config por workspace: ICP, tarifas, providers permitidos, orçamentos.
- Gates: teste prova que workspace A nunca lê/escreve dados de B;
  `auditor` não consegue mutar nada.

## Onda 23 — Fontes empresariais oficiais

**Objetivo:** reduzir dependência de CSV manual com fonte aberta autorizada.

- Conector para base CNPJ aberta da Receita Federal (download/parse local,
  nunca scraping) — avaliar tamanho/viabilidade primeiro.
- Registro de fonte com licença, data de corte e finalidade (já modelado em Onda 10).
- Filtros server-side por CNAE/UF/município antes de materializar empresas.
- Gates: uso dentro dos termos da fonte; dedup contra CSV existente;
  proveniência por lote preservada.

## Onda 24 — Biblioteca de conteúdo e claims

**Objetivo:** Beacon nunca improvisa claim — ele monta a partir de peças aprovadas.

- CRUD de `OfferClaim` com workflow draft → review → approved/rejected.
- Templates de abordagem versionados por persona/oferta/canal.
- Beacon gera rascunho = template aprovado + dados do dossiê; claim não aprovada
  bloqueia a peça correspondente.
- Diff visual de versões de template.
- Gates: zero claim `PENDENTE_DE_VALIDACAO` em rascunho; versionamento imutável;
  toda peça rastreia quais claims/templates usou.

## Onda 25 — Enriquecimento e verificação de dados

**Objetivo:** elevar qualidade do dossiê sem coleta não autorizada.

- Verificação de domínio/site da empresa (HTTP HEAD/GET com timeout, robots respeitado).
- Detecção de sinais públicos: site ativo, e-mail corporativo genérico, redes sociais linkadas.
- Score de completude do dossiê (campos faltantes explícitos).
- Marcação de confiança por campo: `verified | inferred | missing`.
- Gates: somente requisições HTTP simples e auditadas; nenhum bypass de CAPTCHA;
  confiança por campo visível na UI e na exportação.

## Onda 26 — Canais supervisionados (dry-run real)

**Objetivo:** primeira ponte para comunicação externa — sempre atrás de aprovação.

- Adapter de e-mail (SMTP configurável) em modo `dry-run` que registra o que enviaria.
- Adapter WhatsApp Business API (ou equivalente) em sandbox do provedor.
- Fila de aprovação por mensagem com preview renderizado.
- Rate-limit por destinatário/domínio; supressão global.
- Modo `live` exige flag explícita + claim aprovado + aprovação humana nominal.
- Gates: dry-run prova payload completo sem enviar; nenhum byte sai sem
  `approved` + flag; auditoria de cada decisão.

## Onda 27 — Escala e observabilidade

**Objetivo:** operação contínua confiável.

- Workers dedicados por fila (import, IA, outreach) com concorrência configurável.
- Tracing distribuído com correlationId (OpenTelemetry ou equivalente leve).
- Dashboards: fila, latência p50/p95, taxa de erro por provider, custo/dia.
- Alertas: orçamento 80%, provider down, fila travada, job stalled.
- Runbook de incidente.
- Gates: reinício não perde jobs; métricas batem com banco; alerta dispara em teste.

## Onda 28 — IA com memória e qualidade medida

**Objetivo:** agentes que aprendem contexto sem perder auditabilidade.

- Memória por oportunidade: resumo rolante de interações alimenta prompts.
- Few-shot: exemplos aprovados por tipo de tarefa entram no prompt versionado.
- Avaliação de qualidade: scoring automático de outputs (schema, claims, tom)
  com rubrica versionada; regressão de prompt detectada por benchmark.
- A/B de prompts com tráfego supervisionado e relatório.
- Gates: memória nunca inclui PII real; toda inferência registra qual memória/versão usou;
  prompt novo só assume com benchmark não-pior.

## Onda 29 — Segurança e operação enterprise

**Objetivo:** postura defensável para dados comerciais reais.

- Criptografia em repouso do PG (TDE ou volume criptografado) — documentar decisão.
- Backup automatizado + restore testado (drill com evidência).
- SSO/OIDC opcional; MFA para admin.
- Retenção e legal hold; exportação forense de auditoria.
- Pentest leve interno: auth bypass, IDOR, injection em CSV/exports, SSRF nos adapters.
- Gates: restore drill executado com sucesso; nenhum achado crítico aberto;
  relatório de segurança em docs/onda-29/.

## Onda 30 — Go-live supervisionado

**Objetivo:** operação real mínima, segura e reversível.

- Runbook de produção local-first (e caminho de cloud se autorizado).
- SLOs definidos e medidos por 1 semana de operação piloto.
- Plano de rollback por componente; feature flags para cada capacidade externa.
- Auditoria final independente: replay de eventos, reconciliação outbox/audit/usage.
- Documento de operação: o que é automático, o que exige humano, o que está bloqueado.
- Gates: todos os gates G110+ ainda verdes; relatório final de maturidade;
  decisão go/no-go documentada com evidências.

---

## Dependências e riscos transversais

| Risco | Mitigação |
|---|---|
| Credencial de IA nunca autorizada | Ondas 16–17/19–30 não dependem dela; 18 é condicional |
| Fonte CNPJ inviável (tamanho/termos) | Onda 23 começa por spike de viabilidade; CSV segue valendo |
| Escopo de canal externo (Onda 26) | Começa dry-run; `live` é opt-in explícito e reversível |
| Crescimento de `any` na UI | Novo código tipado; débito antigo só em ondas de hardening |
| Regressão entre ondas | Todo merge exige suite completa + diff de gates |

## Critério de sucesso do roadmap

Ao final da Onda 30, o BGO deve operar uma operação comercial supervisionada:
empresas entram por fontes autorizadas, agentes preparam trabalho com IA
(real ou honestamente simulado), humanos aprovam cada saída externa, e tudo é
persistido, auditado e mensurável — sem nunca cruzar a fronteira de envio,
pagamento ou contrato sem aprovação nominal.
