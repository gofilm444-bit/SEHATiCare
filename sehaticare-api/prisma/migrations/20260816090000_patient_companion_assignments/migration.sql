-- CreateEnum
CREATE TYPE "patient_companion_assignment_status" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "patient_companion_assignments" (
    "id" UUID NOT NULL,
    "patient_user_id" UUID NOT NULL,
    "companion_user_id" UUID NOT NULL,
    "facility_id" UUID,
    "assigned_by_user_id" UUID NOT NULL,
    "status" "patient_companion_assignment_status" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_companion_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_companion_assignments_patient_user_id_status_idx" ON "patient_companion_assignments"("patient_user_id", "status");
CREATE INDEX "patient_companion_assignments_companion_user_id_status_idx" ON "patient_companion_assignments"("companion_user_id", "status");
CREATE INDEX "patient_companion_assignments_facility_id_idx" ON "patient_companion_assignments"("facility_id");
CREATE INDEX "patient_companion_assignments_status_started_at_idx" ON "patient_companion_assignments"("status", "started_at");

-- Single active assignment per patient unique constraint (Partial Unique Index)
CREATE UNIQUE INDEX "patient_companion_assignments_one_active_idx" ON "patient_companion_assignments"("patient_user_id") WHERE ("status" = 'ACTIVE');

-- AddForeignKey
ALTER TABLE "patient_companion_assignments" ADD CONSTRAINT "patient_companion_assignments_patient_user_id_fkey" FOREIGN KEY ("patient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_companion_assignments" ADD CONSTRAINT "patient_companion_assignments_companion_user_id_fkey" FOREIGN KEY ("companion_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_companion_assignments" ADD CONSTRAINT "patient_companion_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_companion_assignments" ADD CONSTRAINT "patient_companion_assignments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
