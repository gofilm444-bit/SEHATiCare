-- CreateEnum
CREATE TYPE "hiv_care_enrollment_status" AS ENUM ('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'ENDED');

-- CreateEnum
CREATE TYPE "hiv_monitoring_source" AS ENUM ('DOCTOR', 'PATIENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "viral_load_interpretation" AS ENUM ('DETECTED', 'NOT_DETECTED', 'BELOW_QUANTIFICATION', 'UNKNOWN');

-- CreateTable
CREATE TABLE "hiv_care_enrollments" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT ('hce_' || replace((gen_random_uuid())::text, '-'::text, ''::text)),
    "patient_user_id" UUID NOT NULL,
    "facility_id" UUID,
    "status" "hiv_care_enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiv_care_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hiv_monitoring_entries" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT ('mon_' || replace((gen_random_uuid())::text, '-'::text, ''::text)),
    "enrollment_id" UUID NOT NULL,
    "patient_user_id" UUID NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight_kg" DECIMAL(5,2),
    "cd4_count_cells_mm3" INTEGER,
    "viral_load_copies_ml" INTEGER,
    "viral_load_interpretation" "viral_load_interpretation",
    "tb_screening_result" TEXT,
    "general_condition" TEXT,
    "patient_note" TEXT,
    "clinical_note_private" TEXT,
    "source" "hiv_monitoring_source" NOT NULL DEFAULT 'DOCTOR',
    "archived_at" TIMESTAMP(3),
    "archived_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiv_monitoring_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hiv_care_enrollments_public_id_key" ON "hiv_care_enrollments"("public_id");
CREATE INDEX "hiv_care_enrollments_patient_user_id_status_idx" ON "hiv_care_enrollments"("patient_user_id", "status");
CREATE INDEX "hiv_care_enrollments_facility_id_idx" ON "hiv_care_enrollments"("facility_id");
CREATE INDEX "hiv_care_enrollments_status_enrolled_at_idx" ON "hiv_care_enrollments"("status", "enrolled_at");

-- Single active enrollment per patient unique constraint (Partial Unique Index)
CREATE UNIQUE INDEX "hiv_care_enrollments_one_active_idx" ON "hiv_care_enrollments"("patient_user_id") WHERE ("status" = 'ACTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "hiv_monitoring_entries_public_id_key" ON "hiv_monitoring_entries"("public_id");
CREATE INDEX "hiv_monitoring_entries_patient_user_id_recorded_at_idx" ON "hiv_monitoring_entries"("patient_user_id", "recorded_at" DESC);
CREATE INDEX "hiv_monitoring_entries_enrollment_id_recorded_at_idx" ON "hiv_monitoring_entries"("enrollment_id", "recorded_at" DESC);
CREATE INDEX "hiv_monitoring_entries_recorded_by_user_id_idx" ON "hiv_monitoring_entries"("recorded_by_user_id");
CREATE INDEX "hiv_monitoring_entries_archived_at_idx" ON "hiv_monitoring_entries"("archived_at");

-- AddForeignKey
ALTER TABLE "hiv_care_enrollments" ADD CONSTRAINT "hiv_care_enrollments_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hiv_care_enrollments" ADD CONSTRAINT "hiv_care_enrollments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "hiv_care_enrollments" ADD CONSTRAINT "hiv_care_enrollments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hiv_care_enrollments" ADD CONSTRAINT "hiv_care_enrollments_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hiv_monitoring_entries" ADD CONSTRAINT "hiv_monitoring_entries_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "hiv_care_enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hiv_monitoring_entries" ADD CONSTRAINT "hiv_monitoring_entries_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hiv_monitoring_entries" ADD CONSTRAINT "hiv_monitoring_entries_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hiv_monitoring_entries" ADD CONSTRAINT "hiv_monitoring_entries_archived_by_user_id_fkey" FOREIGN KEY ("archived_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
