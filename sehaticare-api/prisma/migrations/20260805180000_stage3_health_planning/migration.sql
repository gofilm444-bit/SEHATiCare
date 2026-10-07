CREATE TYPE "control_schedule_status" AS ENUM ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','MISSED','RESCHEDULED');
CREATE TYPE "schedule_source" AS ENUM ('USER','HEALTH_WORKER','SYSTEM');
CREATE TYPE "medication_recurrence" AS ENUM ('ONCE','DAILY','WEEKLY','MULTIPLE_DAILY');
CREATE TYPE "medication_occurrence_status" AS ENUM ('PENDING','TAKEN','SKIPPED','SNOOZED','MISSED');
CREATE TYPE "occurrence_response_source" AS ENUM ('USER','SYSTEM');
CREATE TYPE "notification_privacy" AS ENUM ('NEUTRAL','LABEL_IN_APP');
CREATE TYPE "notification_kind" AS ENUM ('CONTROL_SCHEDULE','MEDICATION_REMINDER','SCHEDULE_UPDATED');
CREATE TYPE "notification_delivery_status" AS ENUM ('PENDING','DELIVERED','SUPPRESSED','FAILED');

CREATE TABLE "control_schedules" (
  "id" UUID NOT NULL,
  "public_id" TEXT NOT NULL DEFAULT ('ctl_' || replace(gen_random_uuid()::text, '-', '')),
  "user_id" UUID NOT NULL,
  "facility_id" UUID,
  "worker_id" UUID,
  "previous_schedule_id" UUID,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "control_type" TEXT NOT NULL,
  "user_note" TEXT,
  "worker_note_private" TEXT,
  "worker_note_shared" TEXT,
  "status" "control_schedule_status" NOT NULL DEFAULT 'SCHEDULED',
  "source" "schedule_source" NOT NULL,
  "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
  "reminder_minutes" INTEGER,
  "cancelled_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_by" UUID NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "control_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "control_schedule_timezone_check" CHECK (length("timezone") BETWEEN 3 AND 80),
  CONSTRAINT "control_schedule_reminder_check" CHECK (("reminder_enabled" = false) OR ("reminder_minutes" BETWEEN 5 AND 10080))
);
CREATE UNIQUE INDEX "control_schedules_public_id_key" ON "control_schedules"("public_id");
CREATE INDEX "control_schedules_user_id_status_starts_at_idx" ON "control_schedules"("user_id","status","starts_at");
CREATE INDEX "control_schedules_worker_id_status_starts_at_idx" ON "control_schedules"("worker_id","status","starts_at");
CREATE INDEX "control_schedules_starts_at_reminder_enabled_status_idx" ON "control_schedules"("starts_at","reminder_enabled","status");

CREATE TABLE "control_schedule_history" (
  "id" UUID NOT NULL,
  "schedule_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" "control_schedule_status",
  "to_status" "control_schedule_status",
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "control_schedule_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "control_schedule_history_schedule_id_occurred_at_idx" ON "control_schedule_history"("schedule_id","occurred_at");

CREATE TABLE "medication_reminders" (
  "id" UUID NOT NULL,
  "public_id" TEXT NOT NULL DEFAULT ('med_' || replace(gen_random_uuid()::text, '-', '')),
  "user_id" UUID NOT NULL,
  "display_label" TEXT NOT NULL,
  "medication_name" TEXT,
  "reveal_name_in_app" BOOLEAN NOT NULL DEFAULT false,
  "dosage_text" TEXT,
  "instructions" TEXT,
  "timezone" TEXT NOT NULL,
  "recurrence" "medication_recurrence" NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "active_days" INTEGER[] NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notification_privacy" "notification_privacy" NOT NULL DEFAULT 'NEUTRAL',
  "source" "schedule_source" NOT NULL DEFAULT 'USER',
  "created_by" UUID NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medication_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "medication_reminder_timezone_check" CHECK (length("timezone") BETWEEN 3 AND 80),
  CONSTRAINT "medication_reminder_date_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),
  CONSTRAINT "medication_reminder_days_check" CHECK ("active_days" <@ ARRAY[0,1,2,3,4,5,6])
);
CREATE UNIQUE INDEX "medication_reminders_public_id_key" ON "medication_reminders"("public_id");
CREATE INDEX "medication_reminders_user_id_is_active_deleted_at_idx" ON "medication_reminders"("user_id","is_active","deleted_at");

CREATE TABLE "medication_reminder_times" (
  "id" UUID NOT NULL,
  "reminder_id" UUID NOT NULL,
  "local_time" TEXT NOT NULL,
  CONSTRAINT "medication_reminder_times_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "medication_reminder_time_format_check" CHECK ("local_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE UNIQUE INDEX "medication_reminder_times_reminder_id_local_time_key" ON "medication_reminder_times"("reminder_id","local_time");

CREATE TABLE "medication_occurrences" (
  "id" UUID NOT NULL,
  "public_id" TEXT NOT NULL DEFAULT ('occ_' || replace(gen_random_uuid()::text, '-', '')),
  "reminder_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "responded_at" TIMESTAMP(3),
  "status" "medication_occurrence_status" NOT NULL DEFAULT 'PENDING',
  "snooze_until" TIMESTAMP(3),
  "snooze_count" INTEGER NOT NULL DEFAULT 0,
  "response_source" "occurrence_response_source" NOT NULL DEFAULT 'USER',
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medication_occurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "medication_occurrence_snooze_check" CHECK ("snooze_count" BETWEEN 0 AND 3)
);
CREATE UNIQUE INDEX "medication_occurrences_public_id_key" ON "medication_occurrences"("public_id");
CREATE UNIQUE INDEX "medication_occurrences_reminder_id_scheduled_at_key" ON "medication_occurrences"("reminder_id","scheduled_at");
CREATE INDEX "medication_occurrences_user_id_scheduled_at_status_idx" ON "medication_occurrences"("user_id","scheduled_at","status");
CREATE INDEX "medication_occurrences_status_scheduled_at_idx" ON "medication_occurrences"("status","scheduled_at");

CREATE TABLE "notification_preferences" (
  "user_id" UUID NOT NULL,
  "control_schedule_enabled" BOOLEAN NOT NULL DEFAULT true,
  "medication_enabled" BOOLEAN NOT NULL DEFAULT true,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
  "browser_enabled" BOOLEAN NOT NULL DEFAULT false,
  "sound_enabled" BOOLEAN NOT NULL DEFAULT false,
  "vibration_enabled" BOOLEAN NOT NULL DEFAULT false,
  "preview_detail" BOOLEAN NOT NULL DEFAULT false,
  "hide_medication_name" BOOLEAN NOT NULL DEFAULT true,
  "quiet_hours_start" TEXT,
  "quiet_hours_end" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jayapura',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "notification_quiet_start_check" CHECK ("quiet_hours_start" IS NULL OR "quiet_hours_start" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "notification_quiet_end_check" CHECK ("quiet_hours_end" IS NULL OR "quiet_hours_end" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "deduplication_key" TEXT NOT NULL,
  "kind" "notification_kind" NOT NULL,
  "resource_public_id" TEXT NOT NULL,
  "neutral_text" TEXT NOT NULL,
  "due_at" TIMESTAMP(3) NOT NULL,
  "status" "notification_delivery_status" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "delivered_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "failure_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_neutral_text_check" CHECK ("neutral_text" IN ('Saatnya memeriksa pengingat Anda.','Anda memiliki jadwal yang akan datang.','Ada pembaruan pada jadwal Anda.'))
);
CREATE UNIQUE INDEX "notification_deliveries_deduplication_key_key" ON "notification_deliveries"("deduplication_key");
CREATE INDEX "notification_deliveries_user_id_status_due_at_idx" ON "notification_deliveries"("user_id","status","due_at");
CREATE INDEX "notification_deliveries_status_due_at_idx" ON "notification_deliveries"("status","due_at");

ALTER TABLE "control_schedules" ADD CONSTRAINT "control_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "control_schedules" ADD CONSTRAINT "control_schedules_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "control_schedules" ADD CONSTRAINT "control_schedules_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "control_schedules" ADD CONSTRAINT "control_schedules_previous_schedule_id_fkey" FOREIGN KEY ("previous_schedule_id") REFERENCES "control_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "control_schedule_history" ADD CONSTRAINT "control_schedule_history_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "control_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_schedule_history" ADD CONSTRAINT "control_schedule_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medication_reminders" ADD CONSTRAINT "medication_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medication_reminder_times" ADD CONSTRAINT "medication_reminder_times_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "medication_reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_occurrences" ADD CONSTRAINT "medication_occurrences_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "medication_reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_occurrences" ADD CONSTRAINT "medication_occurrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
