-- Additive migration: existing text messages and legacy upload sessions remain valid.
ALTER TABLE "chat_messages"
ADD COLUMN "voice_note_id" UUID;

CREATE UNIQUE INDEX "chat_messages_voice_note_id_key"
ON "chat_messages"("voice_note_id");

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_voice_note_id_fkey"
FOREIGN KEY ("voice_note_id") REFERENCES "voice_notes"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "voice_note_upload_sessions"
ALTER COLUMN "upload_url" DROP NOT NULL,
ADD COLUMN "content_type" TEXT,
ADD COLUMN "file_size_bytes" INTEGER;
