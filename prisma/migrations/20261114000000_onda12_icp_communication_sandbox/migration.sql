-- Onda 12: ICP Dinâmico, Comunicação Supervisionada e Governança da Oferta Comercial

-- 1. Campos versionados de ICP em Opportunity e Company
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "icpProfileId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "icpVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "icpProfileId" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "icpVersion" INTEGER NOT NULL DEFAULT 1;

-- 2. Extensão do CommercialDraft para versionamento, agendamento e justificativa
ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

-- 3. Tabela CommercialIcpProfile
CREATE TABLE IF NOT EXISTS "CommercialIcpProfile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "description" TEXT,
    "targetSegments" JSONB NOT NULL DEFAULT '[]',
    "targetCnaes" JSONB NOT NULL DEFAULT '[]',
    "targetSizes" JSONB NOT NULL DEFAULT '[]',
    "targetUfs" JSONB NOT NULL DEFAULT '[]',
    "inclusions" JSONB NOT NULL DEFAULT '[]',
    "exclusions" JSONB NOT NULL DEFAULT '[]',
    "weights" JSONB NOT NULL DEFAULT '{}',
    "changeReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialIcpProfile_pkey" PRIMARY KEY ("id")
);

-- 4. Tabela CommercialIcpHistory
CREATE TABLE IF NOT EXISTS "CommercialIcpHistory" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialIcpHistory_pkey" PRIMARY KEY ("id")
);

-- 5. Tabela CommercialDraftHistory
CREATE TABLE IF NOT EXISTS "CommercialDraftHistory" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT,
    "text" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "claimRefs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialDraftHistory_pkey" PRIMARY KEY ("id")
);

-- 6. Tabela CommunicationDispatch (Sandbox persistido)
CREATE TABLE IF NOT EXISTS "CommunicationDispatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "draftId" TEXT,
    "opportunityId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "errorReason" TEXT,
    "dispatchedBy" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationDispatch_pkey" PRIMARY KEY ("id")
);

-- 7. Tabela CommercialOfferItem (Catálogo de Oferta Aprovada)
CREATE TABLE IF NOT EXISTS "CommercialOfferItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_validation',
    "version" TEXT NOT NULL DEFAULT 'offer-v1',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommercialOfferItem_pkey" PRIMARY KEY ("id")
);

-- 8. Índices
CREATE UNIQUE INDEX IF NOT EXISTS "CommercialIcpProfile_workspaceId_name_version_key" ON "CommercialIcpProfile"("workspaceId", "name", "version");
CREATE INDEX IF NOT EXISTS "CommercialIcpProfile_workspaceId_status_idx" ON "CommercialIcpProfile"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "CommercialIcpHistory_profileId_occurredAt_idx" ON "CommercialIcpHistory"("profileId", "occurredAt");
CREATE INDEX IF NOT EXISTS "CommercialDraftHistory_draftId_occurredAt_idx" ON "CommercialDraftHistory"("draftId", "occurredAt");
CREATE INDEX IF NOT EXISTS "CommunicationDispatch_workspaceId_createdAt_idx" ON "CommunicationDispatch"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunicationDispatch_correlationId_idx" ON "CommunicationDispatch"("correlationId");
CREATE INDEX IF NOT EXISTS "CommunicationDispatch_status_idx" ON "CommunicationDispatch"("status");
CREATE INDEX IF NOT EXISTS "CommercialOfferItem_workspaceId_category_status_idx" ON "CommercialOfferItem"("workspaceId", "category", "status");

-- 9. Foreign Keys
ALTER TABLE "CommercialIcpHistory" ADD CONSTRAINT "CommercialIcpHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CommercialIcpProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialDraftHistory" ADD CONSTRAINT "CommercialDraftHistory_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CommercialDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
