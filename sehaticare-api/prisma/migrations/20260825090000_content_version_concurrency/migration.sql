-- AlterTable: Add revision and version tracking to education_articles
ALTER TABLE "education_articles" ADD COLUMN "content_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "education_articles" ADD COLUMN "approved_content_version" INTEGER;

-- AlterTable: Add version tracking to article_clinical_reviews
ALTER TABLE "article_clinical_reviews" ADD COLUMN "content_version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex: Efficient querying by article_id, content_version, and review timestamp
CREATE INDEX "article_clinical_reviews_article_id_content_version_reviewed_at_idx" ON "article_clinical_reviews"("article_id", "content_version", "reviewed_at");

