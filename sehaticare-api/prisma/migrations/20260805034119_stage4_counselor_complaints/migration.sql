-- CreateEnum
CREATE TYPE "service_type" AS ENUM ('COUNSELOR', 'GENERAL_SUPPORT');

-- CreateEnum
CREATE TYPE "service_conversation_status" AS ENUM ('DRAFT', 'QUEUED', 'ASSIGNED', 'ACTIVE', 'WAITING_USER', 'WAITING_COUNSELOR', 'CLOSED', 'CANCELLED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "assignment_source" AS ENUM ('MANUAL', 'SELF_CLAIM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "service_message_kind" AS ENUM ('TEXT', 'VOICE_NOTE', 'SYSTEM_EVENT');

-- CreateEnum
CREATE TYPE "service_message_status" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED', 'REDACTED');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('SPAM', 'HARASSMENT', 'THREAT', 'INAPPROPRIATE_CONTENT', 'PRIVACY_VIOLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "complaint_category" AS ENUM ('SERVICE', 'ACCESS', 'PRIVACY', 'APPLICATION', 'FACILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "complaint_status" AS ENUM ('SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_REVIEW', 'WAITING_USER', 'RESOLVED', 'CLOSED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "complaint_message_type" AS ENUM ('PUBLIC_REPLY', 'INTERNAL_NOTE', 'SYSTEM_EVENT');

-- CreateEnum
CREATE TYPE "retention_status" AS ENUM ('ACTIVE', 'ARCHIVED', 'RESTRICTED', 'REDACTED', 'LEGAL_HOLD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_kind" ADD VALUE 'NEW_MESSAGE';
ALTER TYPE "notification_kind" ADD VALUE 'COMPLAINT_UPDATE';

-- Expand the existing neutral-copy allowlist; no rows or columns are removed.
ALTER TABLE "notification_deliveries" DROP CONSTRAINT "notification_neutral_text_check";
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_neutral_text_check" CHECK ("neutral_text" IN (
  'Saatnya memeriksa pengingat Anda.',
  'Anda memiliki jadwal yang akan datang.',
  'Ada pembaruan pada jadwal Anda.',
  'Anda memiliki pesan baru.',
  'Anda memiliki pembaruan baru.'
));

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "user_role" ADD VALUE 'COUNSELOR';
ALTER TYPE "user_role" ADD VALUE 'COMPLAINT_OFFICER';
ALTER TYPE "user_role" ADD VALUE 'SUPERVISOR';

-- CreateTable
CREATE TABLE "service_conversations" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT 'svc_' || replace(gen_random_uuid()::text, '-', ''),
    "user_id" UUID NOT NULL,
    "service_type" "service_type" NOT NULL,
    "assigned_counselor_id" UUID,
    "status" "service_conversation_status" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT,
    "privacy_mode" TEXT NOT NULL DEFAULT 'ANONYMOUS',
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "closed_by" UUID,
    "close_reason" TEXT,
    "created_by" UUID NOT NULL,
    "reassignment_requested" BOOLEAN NOT NULL DEFAULT false,
    "escalation_reason" TEXT,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "retention_status" "retention_status" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "restricted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counselor_assignments" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "counselor_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "source" "assignment_source" NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "unassignment_reason" TEXT,

    CONSTRAINT "counselor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_messages" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT 'msg_' || replace(gen_random_uuid()::text, '-', ''),
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_role" "user_role" NOT NULL,
    "kind" "service_message_kind" NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "voice_note_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "status" "service_message_status" NOT NULL DEFAULT 'SENT',
    "redacted_at" TIMESTAMP(3),
    "redaction_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_receipts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_events" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" UUID,
    "safe_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_reports" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT 'rpt_' || replace(gen_random_uuid()::text, '-', ''),
    "reporter_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID,
    "reason" "report_reason" NOT NULL,
    "description" TEXT,
    "status" "report_status" NOT NULL DEFAULT 'SUBMITTED',
    "assigned_reviewer" UUID,
    "reviewed_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_blocks" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "counselor_id" UUID NOT NULL,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lifted_at" TIMESTAMP(3),

    CONSTRAINT "conversation_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_settings" (
    "id" UUID NOT NULL,
    "service_type" "service_type" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jayapura',
    "active_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "opens_at" TEXT NOT NULL DEFAULT '08:00',
    "closes_at" TEXT NOT NULL DEFAULT '16:00',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "estimated_response_label" TEXT NOT NULL DEFAULT 'Ditinjau pada jam layanan',
    "max_active_per_counselor" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_voice_upload_sessions" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_voice_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_voice_notes" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT 'vcn_' || replace(gen_random_uuid()::text, '-', ''),
    "conversation_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "conversation_voice_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_tickets" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT 'tkt_' || replace(gen_random_uuid()::text, '-', ''),
    "tracking_code" TEXT NOT NULL,
    "tracking_secret_hash" TEXT NOT NULL,
    "user_id" UUID,
    "alias_snapshot" TEXT,
    "category" "complaint_category" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "complaint_status" NOT NULL DEFAULT 'SUBMITTED',
    "assigned_officer_id" UUID,
    "facility_id" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "assigned_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "acknowledgement_due_at" TIMESTAMP(3) NOT NULL,
    "response_due_at" TIMESTAMP(3) NOT NULL,
    "resolution_due_at" TIMESTAMP(3) NOT NULL,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "privacy_level" TEXT NOT NULL DEFAULT 'ANONYMOUS',
    "consented_at" TIMESTAMP(3) NOT NULL,
    "submission_key" TEXT NOT NULL,
    "retention_status" "retention_status" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "restricted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaint_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_messages" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT 'cmsg_' || replace(gen_random_uuid()::text, '-', ''),
    "ticket_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "sender_role" "user_role",
    "type" "complaint_message_type" NOT NULL,
    "content" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "redacted_at" TIMESTAMP(3),
    "redaction_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_assignments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "officer_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "source" "assignment_source" NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassigned_at" TIMESTAMP(3),
    "unassignment_reason" TEXT,

    CONSTRAINT "complaint_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_sla_configs" (
    "id" UUID NOT NULL,
    "category" "complaint_category",
    "priority" INTEGER,
    "acknowledgement_minutes" INTEGER NOT NULL,
    "response_minutes" INTEGER NOT NULL,
    "resolution_minutes" INTEGER NOT NULL,
    "active_days" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "opens_at" TEXT NOT NULL DEFAULT '08:00',
    "closes_at" TEXT NOT NULL DEFAULT '16:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jayapura',
    "escalation_threshold_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaint_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" UUID,
    "safe_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_attachment_upload_sessions" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "requested_by" UUID,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "committed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_attachment_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_attachments" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL DEFAULT 'att_' || replace(gen_random_uuid()::text, '-', ''),
    "ticket_id" UUID NOT NULL,
    "uploaded_by" UUID,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "quarantine_status" TEXT NOT NULL DEFAULT 'CLEAN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "complaint_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensitive_access_audits" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_role" "user_role",
    "resource_type" TEXT NOT NULL,
    "resource_public_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "reason" TEXT,
    "safe_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_access_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_conversations_public_id_key" ON "service_conversations"("public_id");

-- CreateIndex
CREATE INDEX "service_conversations_user_id_created_at_idx" ON "service_conversations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "service_conversations_status_priority_queued_at_idx" ON "service_conversations"("status", "priority", "queued_at");

-- CreateIndex
CREATE INDEX "service_conversations_assigned_counselor_id_status_last_act_idx" ON "service_conversations"("assigned_counselor_id", "status", "last_activity_at");

-- CreateIndex
CREATE INDEX "counselor_assignments_conversation_id_status_idx" ON "counselor_assignments"("conversation_id", "status");

-- CreateIndex
CREATE INDEX "counselor_assignments_counselor_id_status_assigned_at_idx" ON "counselor_assignments"("counselor_id", "status", "assigned_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_messages_public_id_key" ON "service_messages"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_messages_voice_note_id_key" ON "service_messages"("voice_note_id");

-- CreateIndex
CREATE INDEX "service_messages_conversation_id_created_at_id_idx" ON "service_messages"("conversation_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "service_messages_conversation_id_sender_user_id_idempotency_key" ON "service_messages"("conversation_id", "sender_user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "message_receipts_participant_id_read_at_idx" ON "message_receipts"("participant_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_receipts_message_id_participant_id_key" ON "message_receipts"("message_id", "participant_id");

-- CreateIndex
CREATE INDEX "conversation_events_conversation_id_created_at_idx" ON "conversation_events"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_reports_public_id_key" ON "conversation_reports"("public_id");

-- CreateIndex
CREATE INDEX "conversation_reports_status_created_at_idx" ON "conversation_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_reports_reporter_id_conversation_id_message_id_key" ON "conversation_reports"("reporter_id", "conversation_id", "message_id", "reason");

-- CreateIndex
CREATE INDEX "conversation_blocks_conversation_id_created_at_idx" ON "conversation_blocks"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_blocks_user_id_counselor_id_is_active_key" ON "conversation_blocks"("user_id", "counselor_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_settings_service_type_key" ON "service_settings"("service_type");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_voice_upload_sessions_storage_key_key" ON "conversation_voice_upload_sessions"("storage_key");

-- CreateIndex
CREATE INDEX "conversation_voice_upload_sessions_requested_by_expires_at_idx" ON "conversation_voice_upload_sessions"("requested_by", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_voice_notes_public_id_key" ON "conversation_voice_notes"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_voice_notes_storage_key_key" ON "conversation_voice_notes"("storage_key");

-- CreateIndex
CREATE INDEX "conversation_voice_notes_conversation_id_created_at_idx" ON "conversation_voice_notes"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_tickets_public_id_key" ON "complaint_tickets"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_tickets_tracking_code_key" ON "complaint_tickets"("tracking_code");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_tickets_submission_key_key" ON "complaint_tickets"("submission_key");

-- CreateIndex
CREATE INDEX "complaint_tickets_user_id_created_at_idx" ON "complaint_tickets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "complaint_tickets_status_priority_created_at_idx" ON "complaint_tickets"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "complaint_tickets_assigned_officer_id_status_idx" ON "complaint_tickets"("assigned_officer_id", "status");

-- CreateIndex
CREATE INDEX "complaint_tickets_resolution_due_at_status_idx" ON "complaint_tickets"("resolution_due_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_messages_public_id_key" ON "complaint_messages"("public_id");

-- CreateIndex
CREATE INDEX "complaint_messages_ticket_id_created_at_idx" ON "complaint_messages"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_messages_ticket_id_sender_user_id_idempotency_key_key" ON "complaint_messages"("ticket_id", "sender_user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "complaint_assignments_ticket_id_status_idx" ON "complaint_assignments"("ticket_id", "status");

-- CreateIndex
CREATE INDEX "complaint_assignments_officer_id_status_idx" ON "complaint_assignments"("officer_id", "status");

-- CreateIndex
CREATE INDEX "complaint_sla_configs_category_priority_is_active_idx" ON "complaint_sla_configs"("category", "priority", "is_active");

-- CreateIndex
CREATE INDEX "complaint_events_ticket_id_created_at_idx" ON "complaint_events"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_attachment_upload_sessions_storage_key_key" ON "complaint_attachment_upload_sessions"("storage_key");

-- CreateIndex
CREATE INDEX "complaint_attachment_upload_sessions_ticket_id_expires_at_idx" ON "complaint_attachment_upload_sessions"("ticket_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_attachments_public_id_key" ON "complaint_attachments"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_attachments_storage_key_key" ON "complaint_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "complaint_attachments_ticket_id_created_at_idx" ON "complaint_attachments"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "sensitive_access_audits_resource_type_resource_public_id_cr_idx" ON "sensitive_access_audits"("resource_type", "resource_public_id", "created_at");

-- CreateIndex
CREATE INDEX "sensitive_access_audits_actor_user_id_created_at_idx" ON "sensitive_access_audits"("actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "service_conversations" ADD CONSTRAINT "service_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_conversations" ADD CONSTRAINT "service_conversations_assigned_counselor_id_fkey" FOREIGN KEY ("assigned_counselor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counselor_assignments" ADD CONSTRAINT "counselor_assignments_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counselor_assignments" ADD CONSTRAINT "counselor_assignments_counselor_id_fkey" FOREIGN KEY ("counselor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counselor_assignments" ADD CONSTRAINT "counselor_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_messages" ADD CONSTRAINT "service_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_messages" ADD CONSTRAINT "service_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_messages" ADD CONSTRAINT "service_messages_voice_note_id_fkey" FOREIGN KEY ("voice_note_id") REFERENCES "conversation_voice_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "service_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_receipts" ADD CONSTRAINT "message_receipts_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_events" ADD CONSTRAINT "conversation_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "service_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_blocks" ADD CONSTRAINT "conversation_blocks_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_blocks" ADD CONSTRAINT "conversation_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_blocks" ADD CONSTRAINT "conversation_blocks_counselor_id_fkey" FOREIGN KEY ("counselor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_voice_upload_sessions" ADD CONSTRAINT "conversation_voice_upload_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_voice_notes" ADD CONSTRAINT "conversation_voice_notes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "service_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_tickets" ADD CONSTRAINT "complaint_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_tickets" ADD CONSTRAINT "complaint_tickets_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "complaint_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_messages" ADD CONSTRAINT "complaint_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "complaint_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "complaint_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_attachment_upload_sessions" ADD CONSTRAINT "complaint_attachment_upload_sessions_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "complaint_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_attachments" ADD CONSTRAINT "complaint_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "complaint_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensitive_access_audits" ADD CONSTRAINT "sensitive_access_audits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Safe configuration defaults. Operators can update these rows without code changes.
INSERT INTO "service_settings" ("id", "service_type", "timezone", "active_days", "opens_at", "closes_at", "is_active", "estimated_response_label", "max_active_per_counselor", "updated_at")
VALUES
  (gen_random_uuid(), 'COUNSELOR', 'Asia/Jayapura', ARRAY[1,2,3,4,5], '08:00', '16:00', true, 'Ditinjau pada jam layanan', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GENERAL_SUPPORT', 'Asia/Jayapura', ARRAY[1,2,3,4,5], '08:00', '16:00', true, 'Ditinjau pada jam layanan', 10, CURRENT_TIMESTAMP);

INSERT INTO "complaint_sla_configs" ("id", "category", "priority", "acknowledgement_minutes", "response_minutes", "resolution_minutes", "active_days", "opens_at", "closes_at", "timezone", "escalation_threshold_minutes", "is_active", "updated_at")
VALUES (gen_random_uuid(), NULL, NULL, 240, 480, 2400, ARRAY[1,2,3,4,5], '08:00', '16:00', 'Asia/Jayapura', 60, true, CURRENT_TIMESTAMP);

ALTER TABLE "service_settings" ADD CONSTRAINT "service_settings_time_check" CHECK ("opens_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "closes_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "service_settings" ADD CONSTRAINT "service_settings_limit_check" CHECK ("max_active_per_counselor" BETWEEN 1 AND 100);
ALTER TABLE "complaint_sla_configs" ADD CONSTRAINT "complaint_sla_positive_check" CHECK ("acknowledgement_minutes" > 0 AND "response_minutes" > 0 AND "resolution_minutes" > 0);
ALTER TABLE "complaint_tickets" ADD CONSTRAINT "complaint_priority_check" CHECK ("priority" BETWEEN 0 AND 3);
ALTER TABLE "service_conversations" ADD CONSTRAINT "conversation_priority_check" CHECK ("priority" BETWEEN 0 AND 3);
