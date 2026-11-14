# Ativação Controlada e Governança do Meridian
**Birthub Growth Office — Onda 12**

## 1. Diretrizes de Inferência e Governança de IA
A Onda 12 estabelece o protocolo de controle estrito para ativação de inferência real no agente de qualificação SDR (Meridian):
- **Gateway OpenAI-Compatible:** Contrato padronizado no backend para integração com provedores de IA.
- **Isolamento de PII Real:** Proibição absoluta de envio de dados pessoais reais sem consentimento formal verificado. Apenas dados sintéticos autorizados (`synthetic: true`) podem transitar.
- **Teto Orçamentário e Token Budget:** Controle granular de units de custo por execução (`ExecutionRun`) e verificação do ledger antes de disparos.
- **Schema Validation:** O diagnóstico do Meridian exige conformidade estrita com o schema JSON de saída: `facts`, `inferences`, `recommendations`.

## 2. Estado Honesto: G154 BLOQUEADO POR CREDENCIAL
Durante a inspeção de ambiente da Onda 12:
- A variável `BGO_AI_API_KEY` **não** está presente no ambiente de produção/desenvolvimento.
- O backend opera em modo determinístico e simulado (`BGO_AI_MODE=simulated`, `mock: true`).
- Conforme a Regra 7 de Governança (`AGENTS.md`) e os requisitos do Gate G154:
  - O sistema **não forja nem inventa tokens ou custos falsos**.
  - O gate é reportado com honestidade inegociável como:
    > **G154 — ATIVAÇÃO CONTROLADA DO MERIDIAN: BLOQUEADO POR CREDENCIAL**
  - O Meridian utiliza a rubrica determinística baseada no Perfil de ICP Dinâmico aprovado, gerando score confiável, mapeamento de evidências e apontamento de lacunas no dossiê da conta.
