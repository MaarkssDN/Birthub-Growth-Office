# BGO · Onda 00 — Riscos, Pendências e Roadmap

## 1. Registro de riscos (do documento mestre, com dono de controle)

| Prio | Risco | Controle |
|------|-------|----------|
| Crítico | Reuso de repo/DB/Docker remoto do Birthub 360° | tests/isolation + nomes bgo_*; Docker remoto **bloqueado** por ausência de daemon seguro |
| Crítico | Envio de comunicação não solicitada | Policy engine backend; channel.send = L3 blocked na W00; opt-in obrigatório |
| Alto | Prometer features/preços/cases não verificados | OfferClaim com status; Beacon só usa `approved` |
| Alto | Simulado exibido como real | Flag `simulated` em todo output + selo SIMULAÇÃO na UI + audit |
| Alto | Personagens borrados/inconsistentes | manifest.json com specs; arte final só na Onda 05 com homologação |
| Médio | Acoplamento 3D↔backend | eventos semânticos + AgentVisualState derivado |
| Médio | Custos de IA | MockProvider; custo sempre 0 na W00; orçamento é pendência do proprietário |
| Médio | Autonomia excessiva | L4 proibido; self-approval negado; policy no backend |

## 2. Bloqueios de ambiente (esta execução)

- **Docker indisponível** → modo mock integral; Postgres/Redis/Prisma
  especificados mas não executados. Promoção exige Docker/Podman seguro ou
  Postgres local dedicado.
- **pnpm ausente globalmente** → resolvido via `corepack` (12.18.0).
- Documentos históricos de personagens não fornecidos → não copiados;
  catálogo 29 é a fonte canônica de IDs/nomes/cores.

## 3. Pendências do proprietário (antes de ativação comercial)

Ver `references/onda-00/BIRTHUB_GROWTH_OFFICE_DECISOES_E_PENDENCIAS.md`:
oferta/preços, ICP/região, consentimento/canais, orçamento IA, arte 29,
responsável por aprovações.

## 4. Roadmap (gates de onda)

| Onda | Entrega | Gate de passagem |
|------|---------|------------------|
| 00 | Fundação (este pacote) | docs+build+fluxo sintético; 0 chamadas externas |
| 01 | Captura e CRM: formulário próprio, dedup, pipelines | lead real voluntário com proveniência |
| 02 | Inteligência: pesquisa permitida, dossiês, scoring | contas avaliadas com evidência |
| 03 | Comunicação autorizada: e-mail/canais, opt-in, templates | primeiro contato autorizado registrado |
| 04 | Conversão: agendamento, proposta, handoff | demonstração confirmada |
| 05 | Escritório 3D: cenário, 6 bonequinhos, rigs | eventos reais sincronizados + perf/a11y |
| 06 | Escala até 29 | cada agente só operacional após E2E real |

## 5. Decisões abertas para Onda 01

- Provider de persistência real (Prisma vs alternativa) após ADR de execução.
- Origem do formulário de captura do escritório independente.
- Fornecedores de IA/pesquisa e orçamento — hoje `MockProvider` apenas.
- Definir se `apps/worker` ganha BullMQ real quando Redis estiver disponível.
