# Migrations Onda 10
- prisma/migrations/migration_lock.toml criado (faltava; migrations eram manuais).
- 20261113000000_onda10_scout_costs/migration.sql — aplicadas via `prisma migrate deploy`
  no PG nativo (backup prévio = dump lógico já existente do procedimento Onda 04;
  migration é aditiva: 5 tabelas novas, zero ALTER em tabelas existentes).
- Tabelas: ImportBatch, Company (unique workspaceId+cnpj), CompanyHistory,
  AiTariff (version+provider+model unique), AiUsageRecord.
- prisma generate: client TS regenerado; rename do engine DLL falhou (EPERM,
  arquivo travado por processo node) — client funciona com engine existente
  (mesma versão 6.19.3). Pendente: re-rodar generate quando nenhum node estiver ativo.
