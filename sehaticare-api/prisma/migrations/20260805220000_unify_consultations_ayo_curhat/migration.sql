-- Additive support for verified counselor profiles and unified consultation preferences.
-- Existing consultations, service conversations, messages, voice notes, assignments,
-- receipts, audit events, and user accounts are intentionally left untouched.

CREATE TYPE "consultation_topic" AS ENUM (
  'HEALTH_CONCERN',
  'SERVICE_INFORMATION',
  'EMOTIONAL_SUPPORT',
  'MEDICATION_OR_THERAPY',
  'SERVICE_ACCESS',
  'OTHER'
);

CREATE TYPE "consultation_assignment_mode" AS ENUM (
  'RECOMMENDED',
  'SELECTED',
  'FASTEST',
  'GENERAL_QUEUE'
);

CREATE TABLE "counselor_profiles" (
  "user_id" UUID NOT NULL,
  "permission_enabled" BOOLEAN NOT NULL DEFAULT false,
  "verification_status" "doctor_verification_status" NOT NULL DEFAULT 'PENDING',
  "professional_name" TEXT NOT NULL,
  "profession" TEXT NOT NULL,
  "facility_id" UUID,
  "region_id" UUID,
  "competencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "languages" TEXT[] NOT NULL DEFAULT ARRAY['Bahasa Indonesia']::TEXT[],
  "active_days" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
  "opens_at" TEXT NOT NULL DEFAULT '08:00',
  "closes_at" TEXT NOT NULL DEFAULT '16:00',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jayapura',
  "is_available" BOOLEAN NOT NULL DEFAULT false,
  "max_active_conversations" INTEGER NOT NULL DEFAULT 10,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "verified_at" TIMESTAMP(3),
  "verified_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "counselor_profiles_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "counselor_profiles_hours_check" CHECK (
    "opens_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND
    "closes_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
  ),
  CONSTRAINT "counselor_profiles_capacity_check" CHECK ("max_active_conversations" BETWEEN 1 AND 100)
);

CREATE TABLE "consultation_preferences" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "topic" "consultation_topic" NOT NULL,
  "assignment_mode" "consultation_assignment_mode" NOT NULL,
  "region_id" UUID,
  "facility_id" UUID,
  "selected_counselor_id" UUID,
  "recommended_counselor_id" UUID,
  "recommendation_reasons" JSONB,
  "allow_previous_counselor" BOOLEAN NOT NULL DEFAULT false,
  "fallback_notice" TEXT,
  "submission_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consultation_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "counselor_conflicts" (
  "id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "counselor_id" UUID NOT NULL,
  "reason_code" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "counselor_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "counselor_profiles_permission_verification_active_available_idx"
  ON "counselor_profiles"("permission_enabled", "verification_status", "is_active", "is_available");
CREATE INDEX "counselor_profiles_facility_region_idx" ON "counselor_profiles"("facility_id", "region_id");
CREATE UNIQUE INDEX "consultation_preferences_conversation_id_key" ON "consultation_preferences"("conversation_id");
CREATE UNIQUE INDEX "consultation_preferences_submission_key_key" ON "consultation_preferences"("submission_key");
CREATE INDEX "consultation_preferences_region_facility_idx" ON "consultation_preferences"("region_id", "facility_id");
CREATE INDEX "consultation_preferences_assignment_mode_created_at_idx" ON "consultation_preferences"("assignment_mode", "created_at");
CREATE UNIQUE INDEX "counselor_conflicts_patient_counselor_active_key" ON "counselor_conflicts"("patient_id", "counselor_id", "is_active");
CREATE INDEX "counselor_conflicts_counselor_active_idx" ON "counselor_conflicts"("counselor_id", "is_active");

ALTER TABLE "counselor_profiles" ADD CONSTRAINT "counselor_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counselor_profiles" ADD CONSTRAINT "counselor_profiles_verified_by_fkey"
  FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "counselor_profiles" ADD CONSTRAINT "counselor_profiles_facility_id_fkey"
  FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "counselor_profiles" ADD CONSTRAINT "counselor_profiles_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "consultation_preferences" ADD CONSTRAINT "consultation_preferences_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultation_preferences" ADD CONSTRAINT "consultation_preferences_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultation_preferences" ADD CONSTRAINT "consultation_preferences_facility_id_fkey"
  FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultation_preferences" ADD CONSTRAINT "consultation_preferences_selected_counselor_id_fkey"
  FOREIGN KEY ("selected_counselor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultation_preferences" ADD CONSTRAINT "consultation_preferences_recommended_counselor_id_fkey"
  FOREIGN KEY ("recommended_counselor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "counselor_conflicts" ADD CONSTRAINT "counselor_conflicts_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counselor_conflicts" ADD CONSTRAINT "counselor_conflicts_counselor_id_fkey"
  FOREIGN KEY ("counselor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
