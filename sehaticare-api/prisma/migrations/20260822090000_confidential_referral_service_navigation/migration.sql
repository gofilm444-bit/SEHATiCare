-- AlterEnum
ALTER TYPE "facility_service_type" ADD VALUE IF NOT EXISTS 'CLINICAL_CONSULTATION';
ALTER TYPE "facility_service_type" ADD VALUE IF NOT EXISTS 'ART_CONTINUITY';
ALTER TYPE "facility_service_type" ADD VALUE IF NOT EXISTS 'LAB_MONITORING';
ALTER TYPE "facility_service_type" ADD VALUE IF NOT EXISTS 'REFERRAL_INTAKE';

-- AlterTable
ALTER TABLE "facility_services" 
ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "appointment_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "opening_time" TEXT,
ADD COLUMN IF NOT EXISTS "closing_time" TEXT,
ADD COLUMN IF NOT EXISTS "contact_public" TEXT,
ADD COLUMN IF NOT EXISTS "domicile_requirement" TEXT,
ADD COLUMN IF NOT EXISTS "insurance_requirement" TEXT,
ADD COLUMN IF NOT EXISTS "notes_public" TEXT,
ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateEnum
CREATE TYPE "care_referral_initiation_type" AS ENUM ('PATIENT_REQUEST', 'DOCTOR_INITIATED', 'CARE_SIGNAL_ESCALATION');

-- CreateEnum
CREATE TYPE "care_referral_type" AS ENUM ('CLINICAL_FOLLOW_UP', 'CONTINUITY_OF_CARE', 'LAB_MONITORING', 'MEDICATION_CONTINUITY', 'COUNSELING', 'GENERAL_REFERRAL');

-- CreateEnum
CREATE TYPE "care_referral_status" AS ENUM ('REQUESTED', 'DRAFT', 'PENDING_PATIENT_CONSENT', 'CONSENTED', 'SENT', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "care_referral_decline_reason" AS ENUM ('SERVICE_NOT_AVAILABLE', 'CAPACITY_UNAVAILABLE', 'WRONG_SERVICE', 'NEEDS_DIFFERENT_FACILITY', 'OTHER_OPERATIONAL');

-- CreateEnum
CREATE TYPE "care_referral_event_type" AS ENUM ('REQUESTED', 'DRAFTED', 'PATIENT_CONSENT_REQUESTED', 'PATIENT_CONSENT_GRANTED', 'PATIENT_CONSENT_REVOKED', 'TARGET_SELECTED', 'RECEIVING_DOCTOR_ASSIGNED', 'SENT', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'COMPANION_STATUS_SHARING_ENABLED', 'COMPANION_STATUS_SHARING_DISABLED', 'SUPPORT_CONTACT_ATTEMPTED', 'SUPPORT_CONTACTED');

-- CreateTable
CREATE TABLE "doctor_facility_affiliations" (
    "id" UUID NOT NULL,
    "doctor_user_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_facility_affiliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_referrals" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT ('ref_' || replace((gen_random_uuid())::text, '-'::text, ''::text)),
    "patient_id" UUID NOT NULL,
    "source_facility_id" UUID,
    "source_doctor_id" UUID,
    "target_facility_id" UUID NOT NULL,
    "target_doctor_id" UUID,
    "initiated_by_user_id" UUID NOT NULL,
    "initiation_type" "care_referral_initiation_type" NOT NULL,
    "referral_type" "care_referral_type" NOT NULL,
    "status" "care_referral_status" NOT NULL DEFAULT 'REQUESTED',
    "decline_reason" "care_referral_decline_reason",
    "source_care_signal_id" UUID,
    "scheduling_preference" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consented_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_referral_consents" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "is_consent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "consented_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "consent_version" TEXT NOT NULL DEFAULT '1.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_referral_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_referral_events" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" "care_referral_event_type" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "safe_reason_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_referral_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_referral_companion_shares" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "share_target_facility" BOOLEAN NOT NULL DEFAULT false,
    "enabled_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "care_referral_companion_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_facility_affiliations_doctor_user_id_facility_id_key" ON "doctor_facility_affiliations"("doctor_user_id", "facility_id");
CREATE INDEX "doctor_facility_affiliations_facility_id_is_active_idx" ON "doctor_facility_affiliations"("facility_id", "is_active");
CREATE INDEX "doctor_facility_affiliations_doctor_user_id_is_active_idx" ON "doctor_facility_affiliations"("doctor_user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "care_referrals_public_id_key" ON "care_referrals"("public_id");
CREATE INDEX "care_referrals_patient_id_status_idx" ON "care_referrals"("patient_id", "status");
CREATE INDEX "care_referrals_target_doctor_id_status_idx" ON "care_referrals"("target_doctor_id", "status");
CREATE INDEX "care_referrals_target_facility_id_status_idx" ON "care_referrals"("target_facility_id", "status");
CREATE INDEX "care_referrals_source_doctor_id_status_idx" ON "care_referrals"("source_doctor_id", "status");
CREATE INDEX "care_referrals_requested_at_idx" ON "care_referrals"("requested_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "care_referral_consents_referral_id_key" ON "care_referral_consents"("referral_id");
CREATE INDEX "care_referral_consents_patient_id_is_consent_enabled_idx" ON "care_referral_consents"("patient_id", "is_consent_enabled");

-- CreateIndex
CREATE INDEX "care_referral_events_referral_id_occurred_at_idx" ON "care_referral_events"("referral_id", "occurred_at");
CREATE INDEX "care_referral_events_actor_user_id_occurred_at_idx" ON "care_referral_events"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "care_referral_companion_shares_referral_id_key" ON "care_referral_companion_shares"("referral_id");
CREATE INDEX "care_referral_companion_shares_patient_id_is_enabled_idx" ON "care_referral_companion_shares"("patient_id", "is_enabled");

-- AddForeignKey
ALTER TABLE "doctor_facility_affiliations" ADD CONSTRAINT "doctor_facility_affiliations_doctor_user_id_fkey" FOREIGN KEY ("doctor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doctor_facility_affiliations" ADD CONSTRAINT "doctor_facility_affiliations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_referrals" ADD CONSTRAINT "care_referrals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "care_referrals" ADD CONSTRAINT "care_referrals_source_facility_id_fkey" FOREIGN KEY ("source_facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "care_referrals" ADD CONSTRAINT "care_referrals_source_doctor_id_fkey" FOREIGN KEY ("source_doctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "care_referrals" ADD CONSTRAINT "care_referrals_target_facility_id_fkey" FOREIGN KEY ("target_facility_id") REFERENCES "health_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "care_referrals" ADD CONSTRAINT "care_referrals_target_doctor_id_fkey" FOREIGN KEY ("target_doctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "care_referrals" ADD CONSTRAINT "care_referrals_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_referral_consents" ADD CONSTRAINT "care_referral_consents_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "care_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "care_referral_consents" ADD CONSTRAINT "care_referral_consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_referral_events" ADD CONSTRAINT "care_referral_events_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "care_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "care_referral_events" ADD CONSTRAINT "care_referral_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_referral_companion_shares" ADD CONSTRAINT "care_referral_companion_shares_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "care_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "care_referral_companion_shares" ADD CONSTRAINT "care_referral_companion_shares_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
