CREATE TYPE "professional_service_role" AS ENUM ('COUNSELOR', 'FACILITATOR', 'COMPANION', 'OUTREACH_WORKER', 'SUPPORT_OFFICER');
CREATE TYPE "outreach_case_status" AS ENUM ('OPEN', 'REFERRED', 'CLOSED');
CREATE TYPE "outreach_referral_target" AS ENUM ('COUNSELOR', 'COMPANION', 'FACILITY');

ALTER TABLE "counselor_applications"
  ADD COLUMN "service_role" "professional_service_role" NOT NULL DEFAULT 'COUNSELOR';
ALTER TABLE "counselor_profiles"
  ADD COLUMN "service_role" "professional_service_role" NOT NULL DEFAULT 'COUNSELOR';

UPDATE "counselor_applications" SET "service_role" = CASE
  WHEN lower("profession") = 'fasilitator kesehatan' THEN 'FACILITATOR'::"professional_service_role"
  WHEN lower("profession") = 'pendamping' THEN 'COMPANION'::"professional_service_role"
  WHEN lower("profession") = 'penjangkau' THEN 'OUTREACH_WORKER'::"professional_service_role"
  WHEN lower("profession") = 'petugas dukungan kesehatan' THEN 'SUPPORT_OFFICER'::"professional_service_role"
  ELSE 'COUNSELOR'::"professional_service_role" END;

UPDATE "counselor_profiles" SET "service_role" = CASE
  WHEN lower("profession") = 'fasilitator kesehatan' THEN 'FACILITATOR'::"professional_service_role"
  WHEN lower("profession") = 'pendamping' THEN 'COMPANION'::"professional_service_role"
  WHEN lower("profession") = 'penjangkau' THEN 'OUTREACH_WORKER'::"professional_service_role"
  WHEN lower("profession") = 'petugas dukungan kesehatan' THEN 'SUPPORT_OFFICER'::"professional_service_role"
  ELSE 'COUNSELOR'::"professional_service_role" END;

CREATE TABLE "professional_outreach_cases" (
  "id" UUID NOT NULL,
  "public_id" TEXT NOT NULL DEFAULT ('out_' || replace(gen_random_uuid()::text, '-', '')),
  "created_by" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "region_id" UUID,
  "status" "outreach_case_status" NOT NULL DEFAULT 'OPEN',
  "referral_target" "outreach_referral_target",
  "referral_note" TEXT,
  "referred_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "professional_outreach_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_outreach_cases_creator_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "professional_outreach_cases_region_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "professional_outreach_cases_public_id_key" ON "professional_outreach_cases"("public_id");
CREATE INDEX "professional_outreach_cases_created_by_status_updated_at_idx" ON "professional_outreach_cases"("created_by", "status", "updated_at");
CREATE INDEX "professional_outreach_cases_region_id_status_idx" ON "professional_outreach_cases"("region_id", "status");
