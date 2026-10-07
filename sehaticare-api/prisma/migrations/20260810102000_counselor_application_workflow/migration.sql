-- Additive-only counselor application workflow. Existing users, profiles, and conversations are preserved.
CREATE TYPE "counselor_application_status" AS ENUM (
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED',
  'VERIFIED', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED'
);

CREATE TYPE "counselor_document_type" AS ENUM (
  'IDENTITY', 'PROFESSIONAL_LICENSE', 'CERTIFICATE', 'FACILITY_ASSIGNMENT', 'OTHER'
);

CREATE TABLE "counselor_applications" (
  "id" UUID NOT NULL,
  "public_id" TEXT NOT NULL DEFAULT ('cap_' || replace(gen_random_uuid()::text, '-', '')),
  "user_id" UUID NOT NULL,
  "status" "counselor_application_status" NOT NULL DEFAULT 'DRAFT',
  "professional_name" TEXT NOT NULL,
  "profession" TEXT NOT NULL,
  "license_number" TEXT,
  "facility_id" UUID,
  "region_id" UUID,
  "competencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "languages" TEXT[] NOT NULL DEFAULT ARRAY['Bahasa Indonesia']::TEXT[],
  "active_days" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
  "opens_at" TEXT NOT NULL DEFAULT '08:00',
  "closes_at" TEXT NOT NULL DEFAULT '16:00',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jayapura',
  "max_active_conversations" INTEGER NOT NULL DEFAULT 10,
  "applicant_notes" TEXT,
  "revision_notes" TEXT,
  "rejection_reason" TEXT,
  "submitted_at" TIMESTAMP(3),
  "reviewed_at" TIMESTAMP(3),
  "verified_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "counselor_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "counselor_document_upload_sessions" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "requested_by" UUID NOT NULL,
  "document_type" "counselor_document_type" NOT NULL,
  "storage_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "committed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "counselor_document_upload_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "counselor_documents" (
  "id" UUID NOT NULL,
  "public_id" TEXT NOT NULL DEFAULT ('cdoc_' || replace(gen_random_uuid()::text, '-', '')),
  "application_id" UUID NOT NULL,
  "uploaded_by" UUID NOT NULL,
  "document_type" "counselor_document_type" NOT NULL,
  "storage_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "counselor_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "counselor_review_events" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "safe_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "counselor_review_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "counselor_status_history" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "changed_by" UUID NOT NULL,
  "from_status" "counselor_application_status",
  "to_status" "counselor_application_status" NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "counselor_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "counselor_applications_public_id_key" ON "counselor_applications"("public_id");
CREATE UNIQUE INDEX "counselor_applications_user_id_key" ON "counselor_applications"("user_id");
CREATE INDEX "counselor_applications_status_submitted_at_idx" ON "counselor_applications"("status", "submitted_at");
CREATE UNIQUE INDEX "counselor_document_upload_sessions_storage_key_key" ON "counselor_document_upload_sessions"("storage_key");
CREATE INDEX "counselor_document_upload_sessions_application_id_created_at_idx" ON "counselor_document_upload_sessions"("application_id", "created_at");
CREATE INDEX "counselor_document_upload_sessions_expires_at_committed_at_idx" ON "counselor_document_upload_sessions"("expires_at", "committed_at");
CREATE UNIQUE INDEX "counselor_documents_public_id_key" ON "counselor_documents"("public_id");
CREATE UNIQUE INDEX "counselor_documents_storage_key_key" ON "counselor_documents"("storage_key");
CREATE INDEX "counselor_documents_application_id_document_type_created_at_idx" ON "counselor_documents"("application_id", "document_type", "created_at");
CREATE INDEX "counselor_review_events_application_id_created_at_idx" ON "counselor_review_events"("application_id", "created_at");
CREATE INDEX "counselor_status_history_application_id_created_at_idx" ON "counselor_status_history"("application_id", "created_at");

ALTER TABLE "counselor_applications" ADD CONSTRAINT "counselor_applications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counselor_document_upload_sessions" ADD CONSTRAINT "counselor_document_upload_sessions_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "counselor_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counselor_documents" ADD CONSTRAINT "counselor_documents_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "counselor_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counselor_review_events" ADD CONSTRAINT "counselor_review_events_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "counselor_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "counselor_status_history" ADD CONSTRAINT "counselor_status_history_application_id_fkey"
  FOREIGN KEY ("application_id") REFERENCES "counselor_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
