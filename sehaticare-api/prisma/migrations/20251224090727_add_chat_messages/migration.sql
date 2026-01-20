-- CreateEnum
CREATE TYPE "chat_sender_role" AS ENUM ('PASIEN', 'DOKTER', 'AI');

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "consultation_id" UUID NOT NULL,
    "sender_role" "chat_sender_role" NOT NULL,
    "sender_user_id" UUID,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_messages_consultation_id_created_at_idx" ON "chat_messages"("consultation_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "consultations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
