CREATE TABLE "portal_contents" (
  "id" UUID NOT NULL,
  "section" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "link_url" TEXT,
  "media_url" TEXT,
  "article_id" UUID,
  "video_id" UUID,
  "publication_status" "publication_status" NOT NULL DEFAULT 'DRAFT',
  "display_order" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portal_contents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "portal_contents_article_fkey" FOREIGN KEY ("article_id") REFERENCES "education_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "portal_contents_video_fkey" FOREIGN KEY ("video_id") REFERENCES "education_videos"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "portal_contents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "portal_contents_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "portal_contents_section_publication_status_display_order_idx" ON "portal_contents"("section", "publication_status", "display_order");
CREATE INDEX "portal_contents_article_id_idx" ON "portal_contents"("article_id");
CREATE INDEX "portal_contents_video_id_idx" ON "portal_contents"("video_id");

-- Seed default portal configuration & content
INSERT INTO "portal_contents" ("id", "section", "title", "summary", "link_url", "media_url", "publication_status", "display_order", "created_at", "updated_at")
VALUES
  ('f1000000-0000-4000-8000-000000000001', 'hero', 'Hero utama SEHATiCare', 'Judul utama, subjudul, dan CTA login.', NULL, NULL, 'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f2000000-0000-4000-8000-000000000001', 'edukasiAwal', 'Edukasi Awal HIV', 'Panduan ringkas untuk memahami langkah aman pertama.', NULL, NULL, 'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f2000000-0000-4000-8000-000000000002', 'edukasiAwal', 'Pencegahan & Proteksi', 'Informasi praktis untuk menjaga diri dan pasangan.', NULL, NULL, 'DRAFT', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f3000000-0000-4000-8000-000000000001', 'video', 'Video edukasi singkat', 'Cuplikan 2-3 menit untuk memahami poin utama.', NULL, NULL, 'DRAFT', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f4000000-0000-4000-8000-000000000001', 'infografis', 'Infografis dasar HIV', 'Ringkasan visual yang mudah dibagikan.', NULL, NULL, 'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f5000000-0000-4000-8000-000000000001', 'faq', 'Apakah data saya aman?', 'SEHATiCare menjaga privasi dan kerahasiaan data pengguna.', NULL, NULL, 'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f5000000-0000-4000-8000-000000000002', 'faq', 'Bagaimana memulai konsultasi?', 'Login terlebih dahulu, lalu pilih menu konsultasi.', NULL, NULL, 'PUBLISHED', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f6000000-0000-4000-8000-000000000001', 'carouselImages', 'Sorotan Edukasi', '', '/edukasi', 'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=1200&q=80', 'PUBLISHED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('f6000000-0000-4000-8000-000000000002', 'carouselImages', 'Dukungan Emosional', '', '/edukasi', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80', 'PUBLISHED', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
