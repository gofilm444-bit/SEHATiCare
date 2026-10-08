-- CreateEnum
CREATE TYPE "art_care_plan_status" AS ENUM ('ACTIVE', 'MODIFIED', 'DISCONTINUED', 'COMPLETED');

-- AlterTable
ALTER TABLE "medication_reminders" ADD COLUMN "art_plan_item_id" UUID;

-- CreateTable
CREATE TABLE "art_care_plans" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT ('art_' || replace((gen_random_uuid())::text, '-'::text, ''::text)),
    "patient_user_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "prescribed_by_doctor_id" UUID NOT NULL,
    "status" "art_care_plan_status" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "clinical_notes" TEXT,
    "change_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "art_care_plan_items" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "medication_name" TEXT NOT NULL,
    "strength" TEXT,
    "dose_instructions" TEXT,
    "frequency_per_day" INTEGER NOT NULL DEFAULT 1,
    "timing_description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_care_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "art_adherence_support_consents" (
    "id" UUID NOT NULL,
    "patient_user_id" UUID NOT NULL,
    "is_consent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "consented_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_adherence_support_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "art_care_plans_public_id_key" ON "art_care_plans"("public_id");
CREATE INDEX "art_care_plans_patient_user_id_status_idx" ON "art_care_plans"("patient_user_id", "status");
CREATE INDEX "art_care_plans_enrollment_id_status_idx" ON "art_care_plans"("enrollment_id", "status");
CREATE INDEX "art_care_plans_prescribed_by_doctor_id_idx" ON "art_care_plans"("prescribed_by_doctor_id");

-- Single active ART plan per patient unique constraint (Partial Unique Index)
CREATE UNIQUE INDEX "art_care_plans_one_active_idx" ON "art_care_plans"("patient_user_id") WHERE ("status" = 'ACTIVE');

-- CreateIndex
CREATE INDEX "art_care_plan_items_plan_id_idx" ON "art_care_plan_items"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "art_adherence_support_consents_patient_user_id_key" ON "art_adherence_support_consents"("patient_user_id");
CREATE INDEX "art_adherence_support_consents_patient_user_id_is_consent_enabled_idx" ON "art_adherence_support_consents"("patient_user_id", "is_consent_enabled");

-- CreateIndex
CREATE INDEX "medication_reminders_art_plan_item_id_idx" ON "medication_reminders"("art_plan_item_id");

-- AddForeignKey
ALTER TABLE "art_care_plans" ADD CONSTRAINT "art_care_plans_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "art_care_plans" ADD CONSTRAINT "art_care_plans_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "hiv_care_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "art_care_plans" ADD CONSTRAINT "art_care_plans_prescribed_by_doctor_id_fkey" FOREIGN KEY ("prescribed_by_doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "art_care_plan_items" ADD CONSTRAINT "art_care_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "art_care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "art_adherence_support_consents" ADD CONSTRAINT "art_adherence_support_consents_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_reminders" ADD CONSTRAINT "medication_reminders_art_plan_item_id_fkey" FOREIGN KEY ("art_plan_item_id") REFERENCES "art_care_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
