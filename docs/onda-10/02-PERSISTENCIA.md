# Persistência Scout (G111-G113)
- PrismaCompanyStore/PrismaCostStore em packages/db/src/scout-store.ts;
  MemoryCompanyStore/MemoryCostStore em commercial p/ testes e modo volátil.
- Dedup persistente: unique (workspaceId, cnpj) + upsertCompanies transacional
  por empresa; reimportação → CompanyHistory "reimport_seen", zero duplicatas.
- Lote ImportBatch registra fonte, filename, missionId, correlationId,
  contadores e rejectedDetail (até 200 linhas).
- CompanyHistory append-only: imported, reimport_seen, review_*.
- Empresa ≠ lead: reviewStatus pending|approved|rejected|archived;
  somente humano promove p/ análise (rota exige owner|operator|approver).
- Evidência real executada: import1 inserted=2, import2 inserted=0/dup=2;
  após RESTART da API: 2 empresas, review approved preservado, 2 batches,
  1 AiUsageRecord — tudo lido do PG.
