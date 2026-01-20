-- AlterEnum
ALTER TYPE "user_role" ADD VALUE 'AI';

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "consent_at" TIMESTAMP(3),
ADD COLUMN     "consent_version" TEXT,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "red_flag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "red_flag_reason" TEXT;

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_role" "user_role",
    "action" TEXT NOT NULL,
    "consultation_id" UUID,
    "meta_json" JSONB,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_consultation_id_created_at_idx" ON "audit_events"("consultation_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_created_at_idx" ON "audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at");
