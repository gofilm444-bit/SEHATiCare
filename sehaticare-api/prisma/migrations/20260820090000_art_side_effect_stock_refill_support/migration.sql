-- CreateEnum
CREATE TYPE "art_side_effect_severity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "art_side_effect_status" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateTable
CREATE TABLE "art_side_effect_entries" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT ('se_' || replace((gen_random_uuid())::text, '-'::text, ''::text)),
    "patient_user_id" UUID NOT NULL,
    "art_care_plan_id" UUID,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" "art_side_effect_severity" NOT NULL,
    "symptom_name" TEXT NOT NULL,
    "patient_note" TEXT,
    "status" "art_side_effect_status" NOT NULL DEFAULT 'ACTIVE',
    "resolved_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_side_effect_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "art_medication_stocks" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT ('stk_' || replace((gen_random_uuid())::text, '-'::text, ''::text)),
    "patient_user_id" UUID NOT NULL,
    "art_plan_item_id" UUID,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity_remaining" DECIMAL(7,2),
    "unit" TEXT,
    "estimated_days_remaining" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_medication_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "art_refill_settings" (
    "id" UUID NOT NULL,
    "patient_user_id" UUID NOT NULL,
    "refill_alert_threshold_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_refill_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "art_refill_support_consents" (
    "id" UUID NOT NULL,
    "patient_user_id" UUID NOT NULL,
    "is_consent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "consented_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "art_refill_support_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "art_side_effect_entries_public_id_key" ON "art_side_effect_entries"("public_id");
CREATE INDEX "art_side_effect_entries_patient_user_id_occurred_at_idx" ON "art_side_effect_entries"("patient_user_id", "occurred_at" DESC);
CREATE INDEX "art_side_effect_entries_art_care_plan_id_idx" ON "art_side_effect_entries"("art_care_plan_id");
CREATE INDEX "art_side_effect_entries_status_idx" ON "art_side_effect_entries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "art_medication_stocks_public_id_key" ON "art_medication_stocks"("public_id");
CREATE INDEX "art_medication_stocks_patient_user_id_recorded_at_idx" ON "art_medication_stocks"("patient_user_id", "recorded_at" DESC);
CREATE INDEX "art_medication_stocks_art_plan_item_id_idx" ON "art_medication_stocks"("art_plan_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "art_refill_settings_patient_user_id_key" ON "art_refill_settings"("patient_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "art_refill_support_consents_patient_user_id_key" ON "art_refill_support_consents"("patient_user_id");
CREATE INDEX "art_refill_support_consents_patient_user_id_is_consent_enabled_idx" ON "art_refill_support_consents"("patient_user_id", "is_consent_enabled");

-- AddForeignKey
ALTER TABLE "art_side_effect_entries" ADD CONSTRAINT "art_side_effect_entries_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "art_side_effect_entries" ADD CONSTRAINT "art_side_effect_entries_art_care_plan_id_fkey" FOREIGN KEY ("art_care_plan_id") REFERENCES "art_care_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "art_medication_stocks" ADD CONSTRAINT "art_medication_stocks_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "art_medication_stocks" ADD CONSTRAINT "art_medication_stocks_art_plan_item_id_fkey" FOREIGN KEY ("art_plan_item_id") REFERENCES "art_care_plan_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "art_refill_settings" ADD CONSTRAINT "art_refill_settings_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "art_refill_support_consents" ADD CONSTRAINT "art_refill_support_consents_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
