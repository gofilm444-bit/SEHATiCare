-- AlterTable
ALTER TABLE "education_articles" ADD COLUMN "approved_content_hash" VARCHAR(128);

-- CreateTable
CREATE TABLE "article_clinical_reviews" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "decision" VARCHAR(32) NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "source_reference" TEXT,
    "notes" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_clinical_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_clinical_reviews_article_id_decision_reviewed_at_idx" ON "article_clinical_reviews"("article_id", "decision", "reviewed_at");

-- CreateIndex
CREATE INDEX "article_clinical_reviews_reviewer_id_idx" ON "article_clinical_reviews"("reviewer_id");

-- AddForeignKey
ALTER TABLE "article_clinical_reviews" ADD CONSTRAINT "article_clinical_reviews_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "education_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_clinical_reviews" ADD CONSTRAINT "article_clinical_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

