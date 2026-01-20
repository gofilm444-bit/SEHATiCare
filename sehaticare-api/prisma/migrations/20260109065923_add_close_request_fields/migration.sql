-- AlterTable
ALTER TABLE "consultations" ADD COLUMN     "closeRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closeRequestedAt" TIMESTAMP(3),
ADD COLUMN     "closeRequestedById" UUID;

-- AddForeignKey
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_closeRequestedById_fkey" FOREIGN KEY ("closeRequestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
