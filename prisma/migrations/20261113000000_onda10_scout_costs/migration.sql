-- Onda 10: Central Scout (ImportBatch/Company/CompanyHistory) + custos IA (AiTariff/AiUsageRecord)

CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "filename" TEXT,
    "missionId" TEXT,
    "correlationId" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "rejected" INTEGER NOT NULL DEFAULT 0,
    "rejectedDetail" JSONB,
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "batchId" TEXT,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnae" TEXT,
    "porte" TEXT,
    "situacao" TEXT,
    "municipio" TEXT,
    "uf" TEXT,
    "fonte" TEXT NOT NULL,
    "importadoEm" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreVersion" TEXT NOT NULL DEFAULT 'score-icp-v1',
    "reasons" JSONB NOT NULL DEFAULT '[]',
    "gaps" JSONB NOT NULL DEFAULT '[]',
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "missionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyHistory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiTariff" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "inputPer1MTokens" DECIMAL(65,30) NOT NULL,
    "outputPer1MTokens" DECIMAL(65,30) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTariff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiUsageRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "missionId" TEXT,
    "agentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptKey" TEXT,
    "promptVersion" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costUnits" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DECIMAL(65,30),
    "billedCost" DECIMAL(65,30),
    "tariffVersion" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "correlationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportBatch_workspaceId_createdAt_idx" ON "ImportBatch"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "Company_workspaceId_cnpj_key" ON "Company"("workspaceId", "cnpj");
CREATE INDEX "Company_workspaceId_reviewStatus_idx" ON "Company"("workspaceId", "reviewStatus");
CREATE INDEX "Company_workspaceId_uf_idx" ON "Company"("workspaceId", "uf");
CREATE INDEX "CompanyHistory_companyId_occurredAt_idx" ON "CompanyHistory"("companyId", "occurredAt");
CREATE UNIQUE INDEX "AiTariff_version_provider_model_key" ON "AiTariff"("version", "provider", "model");
CREATE INDEX "AiUsageRecord_workspaceId_occurredAt_idx" ON "AiUsageRecord"("workspaceId", "occurredAt");
CREATE INDEX "AiUsageRecord_missionId_idx" ON "AiUsageRecord"("missionId");
CREATE INDEX "AiUsageRecord_agentId_idx" ON "AiUsageRecord"("agentId");

ALTER TABLE "Company" ADD CONSTRAINT "Company_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyHistory" ADD CONSTRAINT "CompanyHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
