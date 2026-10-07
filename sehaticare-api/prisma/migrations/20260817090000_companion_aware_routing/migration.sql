-- AlterEnum
ALTER TYPE "assignment_source" ADD VALUE 'LONGITUDINAL';

-- AlterTable
ALTER TABLE "service_conversations" ADD COLUMN "service_intent" VARCHAR(50) NOT NULL DEFAULT 'COUNSELING';

-- CreateIndex
CREATE INDEX "service_conversations_service_intent_status_idx" ON "service_conversations"("service_intent", "status");
