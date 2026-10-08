-- CreateEnum
CREATE TYPE "care_signal_type" AS ENUM ('SEVERE_SIDE_EFFECT_REPORTED', 'FOLLOW_UP_OVERDUE', 'REFILL_NEEDS_ATTENTION', 'PATIENT_REQUESTED_CLINICAL_CONTACT', 'PATIENT_REQUESTED_COMPANION_SUPPORT');

-- CreateEnum
CREATE TYPE "care_signal_scope" AS ENUM ('CLINICAL', 'SUPPORT');

-- CreateEnum
CREATE TYPE "care_signal_priority" AS ENUM ('ROUTINE', 'ATTENTION', 'PRIORITY');

-- CreateEnum
CREATE TYPE "care_signal_status" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "care_signal_action_type" AS ENUM ('ACKNOWLEDGED', 'CONTACT_ATTEMPTED', 'CONTACTED', 'FOLLOW_UP_SCHEDULED', 'ESCALATED_TO_CLINICAL', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "care_signals" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT ('sig_' || replace((gen_random_uuid())::text, '-'::text, ''::text)),
    "patient_id" UUID NOT NULL,
    "signal_type" "care_signal_type" NOT NULL,
    "signal_scope" "care_signal_scope" NOT NULL,
    "priority" "care_signal_priority" NOT NULL,
    "status" "care_signal_status" NOT NULL DEFAULT 'OPEN',
    "source_type" TEXT NOT NULL,
    "source_id" UUID,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_signal_actions" (
    "id" UUID NOT NULL,
    "care_signal_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action_type" "care_signal_action_type" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_follow_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_signal_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_follow_up_support_consents" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "is_consent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "consented_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_follow_up_support_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "care_signals_public_id_key" ON "care_signals"("public_id");
CREATE INDEX "care_signals_patient_id_status_idx" ON "care_signals"("patient_id", "status");
CREATE INDEX "care_signals_signal_type_status_idx" ON "care_signals"("signal_type", "status");
CREATE INDEX "care_signals_signal_scope_status_priority_idx" ON "care_signals"("signal_scope", "status", "priority");
CREATE INDEX "care_signals_source_type_source_id_status_idx" ON "care_signals"("source_type", "source_id", "status");
CREATE INDEX "care_signals_detected_at_idx" ON "care_signals"("detected_at" DESC);

-- CreateIndex
CREATE INDEX "care_signal_actions_care_signal_id_occurred_at_idx" ON "care_signal_actions"("care_signal_id", "occurred_at");
CREATE INDEX "care_signal_actions_actor_user_id_occurred_at_idx" ON "care_signal_actions"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "care_follow_up_support_consents_patient_id_key" ON "care_follow_up_support_consents"("patient_id");
CREATE INDEX "care_follow_up_support_consents_patient_id_is_consent_enabled_idx" ON "care_follow_up_support_consents"("patient_id", "is_consent_enabled");

-- AddForeignKey
ALTER TABLE "care_signals" ADD CONSTRAINT "care_signals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "care_signals" ADD CONSTRAINT "care_signals_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "care_signals" ADD CONSTRAINT "care_signals_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "care_signals" ADD CONSTRAINT "care_signals_dismissed_by_fkey" FOREIGN KEY ("dismissed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_signal_actions" ADD CONSTRAINT "care_signal_actions_care_signal_id_fkey" FOREIGN KEY ("care_signal_id") REFERENCES "care_signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "care_signal_actions" ADD CONSTRAINT "care_signal_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_follow_up_support_consents" ADD CONSTRAINT "care_follow_up_support_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
