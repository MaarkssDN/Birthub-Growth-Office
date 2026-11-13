# Onda 11 — Diagnóstico Inicial

## 1. Identificação e Contexto
- **Repositório exclusivo:** `C:\Github\Birthub-Growth-Office`
- **Branch base:** `feat/onda-10` @ commit `90f5214` ("docs(onda-10): documentacao completa da onda 10")
- **Branch de trabalho:** `feat/onda-11` (criada a partir de `feat/onda-10` preservando commits históricos `7f22ebe`, `2e550f3`, `90f5214`)
- **Governança:** `AGENTS.md` e regras invioláveis de isolamento, contratos imutáveis, 29 personas (6 ativas) e proibição de push/deploy automático.

## 2. Auditoria da Infraestrutura e Serviços Locais
- **PostgreSQL Nativo:** 127.0.0.1:5437 (`birthub_growth_office_dev`), ativo e auditado.
- **Memurai (Redis):** 127.0.0.1:6387, ativo e auditado.
- **Portas HTTP:** API em 127.0.0.1:4181, Web em 127.0.0.1:4180.
- **Modo de IA:** `simulated` (sem chave `BGO_AI_API_KEY` injetada no ambiente local; honestidade operacional mantida, G85/G144 documentados como bloqueados por credencial sem mascaramento).

## 3. Estado das Entidades e Encadeamento Preexistente
- **Modelos existentes (Onda 10):** `Company`, `ImportBatch`, `Lead`, `Opportunity`, `OpportunityHistory`, `Mission`, `AiUsageRecord`, `TariffSchedule`, `ApprovalRequest`, `AuditEvent`, `EventOutbox`.
- **G116 Pendente:** A Onda 10 implementou a Central Scout com importação e enriquecimento heurístico, porém a promoção de empresa aprovada para oportunidade comercial conectada a uma missão comercial dos 6 agentes ficou pendente (`G116 ⚠️`).
- **Problemas crônicos observados na Onda 10:**
  1. *Prisma EPERM no Windows*: Processos node em execução seguram locks na DLL do Prisma query engine durante regeneração.
  2. *Build OOM do Vite/Three.js*: Bundle monólitico de Three.js excedia consumo de heap no workspace.

## 4. Plano de Ação da Onda 11
1. Sanar arquiteturalmente os problemas de infraestrutura (script regenerador seguro `scripts/prisma-safe-generate.mjs` e code-splitting do Three.js no `vite.config.ts`).
2. Fechar o encadeamento comercial G116: promoção autorizada de empresa para oportunidade com deduplicação atômica e advisory locks no PostgreSQL.
3. Orquestrar os 6 agentes ativos (Aegis, Relay, Scout, Meridian, Beacon, Pledge) em missões comerciais rastreáveis.
4. Construir a visão de Pipeline Comercial (`PipelineView`), aprimorar a Central de Aprovações e conectar o Escritório 3D ao contexto comercial.
5. Executar suíte de homologação visual Playwright em Desktop (1440x900) e Mobile (390x844).
6. Auditar todos os Gates (G130 a G144) com integridade e rigor.
