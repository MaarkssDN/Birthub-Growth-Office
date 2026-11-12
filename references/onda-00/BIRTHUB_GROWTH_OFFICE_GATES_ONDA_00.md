# Matriz de homologação — BGO · Onda 00

- [ ] **G00 — Verdade comercial:** Oferta e ICP classificados como aprovados ou pendentes; claims não verificados bloqueados. Evidência: docs, fixture e testes de validação.
- [ ] **G01 — Isolamento físico/lógico:** Nova raiz, banco, volumes, secrets, portas, containers; 0 dependências do Birthub. Evidência: tree, env.example sanitizado e inspeção de containers.
- [ ] **G02 — Reprodutibilidade:** Instalação, lint, tsc, testes e build sem passos ocultos. Evidência: logs de comandos executados.
- [ ] **G03 — Integridade do elenco:** 29 IDs únicos, 9+15+4+1, seis ativos sem runtime presumido. Evidência: teste de registry/catálogo.
- [ ] **G04 — Autonomia/autorizações:** API bloqueia contato externo e ações proibidas sem aprovação. Evidência: testes negativos e trilha de negação.
- [ ] **G05 — Fluxo comercial interno:** Lead sintético percorre triagem→rascunho→aprovação sem envio. Evidência: E2E com correlação e flag SIMULADO.
- [ ] **G06 — Auditoria e eventos:** Eventos versionados, correlationId, autor, resultado e PII mínima. Evidência: fixtures e consulta de audit trail.
- [ ] **G07 — Experiência/estados:** 6 estados reativos, aprovação/simulação explícitas; UI responsiva. Evidência: smoke de UI, teclado e reduced-motion.
- [ ] **G08 — Segurança de ambiente:** Sem segredo em código, DB/Redis localhost, bloqueio Docker remoto inseguro. Evidência: scans, portas, registros de configuração.
- [ ] **G09 — Governança:** Relatório do que foi implementado, testes reais, riscos, handoffs e próximos passos. Evidência: relatório assinado pela execução.

**Estado inicial: NÃO EXECUTADO.**
