-- Onda 11: Pipeline Comercial (Opportunity + OpportunityHistory + vínculos Company/Mission/ExecutionRun/CommercialDraft)

ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_leadId_fkey";
ALTER TABLE "Opportunity" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN "stage" SET DEFAULT 'approved_target';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "missionId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "icpScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "currentAgentId" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "justification" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'scout';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "correlationId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "lostReason" TEXT;

CREATE TABLE IF NOT EXISTS "OpportunityHistory" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "correlationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;

ALTER TABLE "ExecutionRun" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExecutionRun" ADD COLUMN IF NOT EXISTS "input" JSONB;
ALTER TABLE "ExecutionRun" ADD COLUMN IF NOT EXISTS "output" JSONB;

ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "CommercialDraft" ADD COLUMN IF NOT EXISTS "opportunityId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Opportunity_workspaceId_companyId_key" ON "Opportunity"("workspaceId", "companyId");
CREATE INDEX IF NOT EXISTS "Opportunity_workspaceId_stage_idx" ON "Opportunity"("workspaceId", "stage");
CREATE INDEX IF NOT EXISTS "Opportunity_workspaceId_currentAgentId_idx" ON "Opportunity"("workspaceId", "currentAgentId");
CREATE INDEX IF NOT EXISTS "OpportunityHistory_opportunityId_occurredAt_idx" ON "OpportunityHistory"("opportunityId", "occurredAt");

ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityHistory" ADD CONSTRAINT "OpportunityHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
