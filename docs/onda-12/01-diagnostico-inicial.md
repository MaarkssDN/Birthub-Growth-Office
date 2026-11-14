# Diagnóstico Inicial e Baseline — Onda 12
**Birthub Growth Office — Operação Comercial Integrada**

## 1. Contexto e Ponto de Partida
- **Repositório:** `C:\Github\Birthub-Growth-Office` (independente, isolado do Birthub 360°).
- **Branch de Origem:** `feat/onda-11` no commit `0266f83`.
- **Branch Criada:** `feat/onda-12`.
- **Governança:** `AGENTS.md` e regras invioláveis (sem envios externos, sem PII real, TypeScript strict, isolamento total, commits locais atômicos).

## 2. Reconciliação dos Testes Históricos (115 vs 110)
A auditoria minuciosa da suíte de testes desvendou a divergência reportada entre a Onda 10 e a Onda 11:
- Na **Onda 09**, o repositório possuía **89 testes** em 15 arquivos.
- Na **Onda 10**, foram adicionados **13 testes** (total real: **102 testes** em 18 arquivos). No entanto, o documento `docs/onda-10/06-GATES.md` calculou erroneamente `102 + 13 = 115`, registrando uma soma dupla de 13 testes adicionais.
- Na **Onda 11**, foram adicionados exatamente **8 testes** (4 testes em `tests/unit/opportunity-store.test.ts` e 4 testes em `tests/api/onda11.test.ts`), totalizando exatamente **110 testes** em 20 arquivos.
- **Conclusão:** Não houve perda de testes. A suíte de 110 testes na ponta da Onda 11 era o baseline exato e íntegro do sistema.

## 3. Auditoria de Infraestrutura e Processos
- **PostgreSQL 17:** Ativo e operando na porta nativa `5437` (`127.0.0.1`), banco `birthub_growth_office_dev`.
- **Memurai (Redis):** Ativo e operando na porta `6387` (`127.0.0.1`).
- **Prisma Safe Generate (`scripts/prisma-safe-generate.mjs`):** Process-termination rigorosamente delimitado aos processos Node que mantêm handles no Prisma Engine (`query_engine-windows.dll.node`), sem afetar processos do sistema operacional ou serviços globais.
- **Inventário de Evidências:** Confirmada a presença de 16 screenshots na pasta `docs/onda-11/evidencias/`.
- **Modo de IA:** Confirmada a ausência de `BGO_AI_API_KEY` no ambiente local e backend em `BGO_AI_MODE=simulated`. Conforme política de estado honesto, a inferência externa permanece bloqueada por credencial (`G154 BLOQUEADO POR CREDENCIAL`), operando por rubrica determinística e schema estruturado.
