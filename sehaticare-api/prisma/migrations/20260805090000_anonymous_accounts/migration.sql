-- Tahap 1: additive identity and consent fields. Existing identity columns are preserved.
CREATE TYPE "account_mode" AS ENUM ('LEGACY', 'ANONYMOUS');
CREATE TYPE "consent_type" AS ENUM ('TERMS', 'PRIVACY');

ALTER TABLE "users"
  ADD COLUMN "public_id" TEXT,
  ADD COLUMN "login_id" TEXT,
  ADD COLUMN "display_alias" TEXT,
  ADD COLUMN "account_mode" "account_mode" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "recovery_code_hash" TEXT,
  ADD COLUMN "recovery_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "credentials_shown_at" TIMESTAMP(3),
  ADD COLUMN "last_alias_changed_at" TIMESTAMP(3),
  ADD COLUMN "avatar_key" TEXT DEFAULT 'avatar-leaf',
  ADD COLUMN "preferred_language" TEXT NOT NULL DEFAULT 'id',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Jayapura',
  ADD COLUMN "accessibility_preferences" JSONB,
  ADD COLUMN "notification_preferences" JSONB,
  ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

-- PostgreSQL 13+ supplies cryptographically random UUIDs. This only populates the new column.
UPDATE "users"
SET "public_id" = 'usr_' || replace(gen_random_uuid()::text, '-', '')
WHERE "public_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "public_id" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "public_id" SET DEFAULT ('usr_' || replace(gen_random_uuid()::text, '-', ''));
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

CREATE TABLE "account_consents" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "consent_type" "consent_type" NOT NULL,
  "policy_version" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL,
  CONSTRAINT "account_consents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "account_consents_user_id_consent_type_policy_version_key"
  ON "account_consents"("user_id", "consent_type", "policy_version");
CREATE INDEX "account_consents_user_id_accepted_at_idx"
  ON "account_consents"("user_id", "accepted_at");
ALTER TABLE "account_consents" ADD CONSTRAINT "account_consents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
