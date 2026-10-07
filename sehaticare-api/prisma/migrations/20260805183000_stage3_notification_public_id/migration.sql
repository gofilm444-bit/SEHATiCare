ALTER TABLE "notification_deliveries"
  ADD COLUMN "public_id" TEXT NOT NULL DEFAULT ('ntf_' || replace(gen_random_uuid()::text, '-', ''));
CREATE UNIQUE INDEX "notification_deliveries_public_id_key" ON "notification_deliveries"("public_id");
