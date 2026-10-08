-- CreateTable
CREATE TABLE "user_privacy_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lock_on_background" BOOLEAN NOT NULL DEFAULT true,
    "auto_lock_minutes" INTEGER DEFAULT 5,
    "require_reauth_to_unlock" BOOLEAN NOT NULL DEFAULT false,
    "discreet_page_titles" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_privacy_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_privacy_preferences_user_id_key" ON "user_privacy_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "user_privacy_preferences" ADD CONSTRAINT "user_privacy_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
