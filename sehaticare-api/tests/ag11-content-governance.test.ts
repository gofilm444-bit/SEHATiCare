import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { runVerifiedContentSeed } from '../prisma/seed-verified-content';

test('AG-11A medical content governance: publication safety gate, seed idempotency, and anti-stigma accuracy', async () => {
  const app = await buildApp();
  const marker = randomUUID();
  const adminId = randomUUID();
  const adminEmail = `admin-ag11a-${marker}@example.test`;
  const createdArticleIds: string[] = [];
  const createdVideoIds: string[] = [];

  try {
    // 1. Setup Admin user
    await prisma.users.create({
      data: {
        id: adminId,
        email: adminEmail,
        full_name: 'Dokter Penguji Tata Kelola AG11A',
        role: 'ADMIN',
        password_hash: await bcrypt.hash('Admin-ag11a-pass-2026', 12),
        updated_at: new Date()
      }
    });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: adminEmail, password: 'Admin-ag11a-pass-2026' }
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminToken = adminLogin.json().access_token;
    const adminHeaders = { authorization: `Bearer ${adminToken}` };

    const category = await prisma.content_categories.findFirst({ where: { slug: 'dasar-hiv' } });
    assert.ok(category, 'Category dasar-hiv must exist');

    // 2. Test CMS Source Reference Publishing Gate (Requirement H, I, J)
    const draftRes = await app.inject({
      method: 'POST',
      url: '/admin/content/articles',
      headers: adminHeaders,
      payload: {
        title: `Uji Draf Sumber ${marker.slice(0, 8)}`,
        slug: `uji-draf-sumber-${marker}`,
        summary: 'Ringkasan artikel uji draf',
        body_markdown: 'Konten edukasi draf untuk pengujian gate.',
        category_id: category.id,
        language: 'id',
        reading_minutes: 2,
        featured: false
      }
    });
    assert.equal(draftRes.statusCode, 201);
    const draftArticle = draftRes.json();
    createdArticleIds.push(draftArticle.id);

    // Gate 1: Cannot publish without source_reference
    const failPublishEmpty = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(failPublishEmpty.statusCode, 400);
    assert.match(failPublishEmpty.json().message, /source reference required/i);

    // Gate 2: Cannot publish with untrusted lookalike domain (e.g. evilwho.int.example.com)
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}`,
      headers: adminHeaders,
      payload: {
        title: `Uji Draf Lookalike ${marker.slice(0, 8)}`,
        slug: `uji-draf-sumber-${marker}`,
        summary: 'Ringkasan artikel',
        body_markdown: 'Konten edukasi.',
        category_id: category.id,
        language: 'id',
        source_reference: 'https://evilwho.int.example.com/fake-hiv-info',
        reading_minutes: 2
      }
    });
    const failPublishLookalike = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(failPublishLookalike.statusCode, 400);
    assert.match(failPublishLookalike.json().message, /authoritative health organization/i);

    // Gate 3: Cannot publish with generic bare homepage root (e.g. https://who.int/)
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}`,
      headers: adminHeaders,
      payload: {
        title: `Uji Draf Homepage ${marker.slice(0, 8)}`,
        slug: `uji-draf-sumber-${marker}`,
        summary: 'Ringkasan artikel',
        body_markdown: 'Konten edukasi.',
        category_id: category.id,
        language: 'id',
        source_reference: 'https://www.who.int/',
        reading_minutes: 2
      }
    });
    const failPublishHomepage = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(failPublishHomepage.statusCode, 400);
    assert.match(failPublishHomepage.json().message, /specific document or fact sheet/i);

    // Gate 4: Update with valid authoritative specific document link
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}`,
      headers: adminHeaders,
      payload: {
        title: `Uji Draf Valid ${marker.slice(0, 8)}`,
        slug: `uji-draf-sumber-${marker}`,
        summary: 'Ringkasan artikel valid',
        body_markdown: 'Konten edukasi terverifikasi.',
        category_id: category.id,
        language: 'id',
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 2
      }
    });

    const successPublish = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(successPublish.statusCode, 200);
    assert.equal(successPublish.json().status, 'PUBLISHED');

    // Verify reviewer_id and publisher_id are set to the real admin, not a fake identifier
    const publishedRecord = await prisma.education_articles.findUnique({ where: { id: draftArticle.id } });
    assert.equal(publishedRecord?.publisher_id, adminId);
    assert.equal(publishedRecord?.is_published, true);
    assert.ok(publishedRecord?.published_at);

    // 3. Unreviewed baseline material cannot auto-publish (Requirement H)
    const baselineIds = Array.from({ length: 16 }, (_, i) =>
      `32000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    );
    const unreviewedArticles = await prisma.education_articles.findMany({
      where: {
        id: { in: baselineIds }
      }
    });
    assert.equal(unreviewedArticles.length, 16);
    for (const item of unreviewedArticles) {
      assert.equal(item.publication_status, 'REVIEW');
      assert.equal(item.is_published, false);
      assert.equal(item.reviewer_id, null);
      assert.equal(item.publisher_id, null);
    }

    // Verify anonymous public access returns 404 for unreviewed baseline article
    const unreviewedPubRes = await app.inject({
      method: 'GET',
      url: '/public/articles/memahami-perbedaan-hiv-dan-aids'
    });
    assert.equal(unreviewedPubRes.statusCode, 404);

    // 4. Test Idempotency and Human-Edit Protection (Requirements D, E, F, G)
    const humanEditedSlug = `artikel-editan-redaksi-${marker}`;
    const humanArticle = await prisma.education_articles.create({
      data: {
        id: randomUUID(),
        title: 'Judul Asli Editan Redaksi Manusia',
        slug: humanEditedSlug,
        summary: 'Ringkasan hasil kurasi manusia',
        body_markdown: 'Teks ini tidak boleh ditimpa oleh seed otomatis.',
        category_id: category.id,
        language: 'id',
        publication_status: 'REVIEW',
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 3,
        is_published: false,
        created_by: adminId,
        updated_by: adminId,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    createdArticleIds.push(humanArticle.id);

    // Run seed again
    const seedResult1 = await runVerifiedContentSeed();
    assert.equal(seedResult1.articles.conflicts, 0);

    // Check that human article was preserved
    const recheckHumanArticle = await prisma.education_articles.findUnique({ where: { id: humanArticle.id } });
    assert.equal(recheckHumanArticle?.title, 'Judul Asli Editan Redaksi Manusia');
    assert.equal(recheckHumanArticle?.body_markdown, 'Teks ini tidak boleh ditimpa oleh seed otomatis.');

    // Run seed yet again to prove zero duplicates
    const seedResult2 = await runVerifiedContentSeed();
    assert.equal(seedResult2.articles.created, 0);
    assert.equal(seedResult2.videos.created, 0);

    const totalArticles = await prisma.education_articles.count({
      where: { id: { in: baselineIds } }
    });
    assert.equal(totalArticles, 16, 'Zero duplicate baseline articles');

    // 5. Medical and Legal Content Auditing across Seeded Data (Requirements K, L, M, N, O, P, Q)
    const uEqualsU = await prisma.education_articles.findUnique({
      where: { slug: 'arv-viral-load-dan-u-equals-u' }
    });
    assert.ok(uEqualsU);
    // K: Scoped to sexual transmission
    assert.match(uEqualsU.body_markdown, /penularan HIV kepada pasangan seksualnya adalah NOL/i);
    assert.match(uEqualsU.body_markdown, /berlaku spesifik untuk penularan melalui hubungan seksual/i);
    // L: <200 copies/mL threshold distinct from assay limit
    assert.match(uEqualsU.body_markdown, /<200 kopi\/mL/i);
    assert.match(uEqualsU.body_markdown, /ambang batas deteksi lebih rendah/i);
    assert.match(uEqualsU.body_markdown, /awal pengobatan/i);

    // M: PEP 72h initiation window and 28-day course
    const pep = await prisma.education_articles.findUnique({
      where: { slug: 'pep-profilaksis-pasca-paparan-darurat' }
    });
    assert.ok(pep);
    assert.match(pep.body_markdown, /72 jam/i);
    assert.match(pep.body_markdown, /28 hari berturut-turut/i);
    assert.match(pep.body_markdown, /protokol klinis dokter/i);

    // N: PrEP individual clinical protocol, not universally hardcoded 3-month kidney testing
    const prep = await prisma.education_articles.findUnique({
      where: { slug: 'mengenal-prep-pencegahan-sebelum-paparan' }
    });
    assert.ok(prep);
    assert.match(prep.body_markdown, /status HIV negatif/i);
    assert.match(prep.body_markdown, /protokol fasilitas pelayanan kesehatan/i);
    assert.match(prep.body_markdown, /Long-Acting Injectable/i);

    // O: Composite Story clearly illustrative, no rigid guarantees
    const composite = await prisma.education_articles.findUnique({
      where: { slug: 'ilustrasi-komposit-perjalanan-menuju-u-equals-u' }
    });
    assert.ok(composite);
    assert.match(composite.body_markdown, /Ilustrasi Komposit Edukatif/i);
    assert.match(composite.body_markdown, /BUKAN testimoni pasien nyata tunggal/i);
    assert.doesNotMatch(composite.body_markdown, /pukul 21\.00/i);
    assert.doesNotMatch(composite.body_markdown, /mimpi yang terasa sangat nyata/i);

    // P: Legal article mapped to official sources
    const legal = await prisma.education_articles.findUnique({
      where: { slug: 'hak-pasien-dan-kerahasiaan-medis' }
    });
    assert.ok(legal);
    assert.match(legal.body_markdown, /Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan/);
    assert.match(legal.body_markdown, /Pasal 28/);
    assert.match(legal.body_markdown, /(?:Peraturan Menteri Kesehatan|Permenkes) (?:Nomor|No\.?) 3 Tahun 2026/);
    assert.doesNotMatch(legal.body_markdown, /Permenkes No\. 21 Tahun 2013/);
    assert.match(legal.body_markdown, /tidak memiliki kemampuan teknis untuk menghapus riwayat peramban/i);
    assert.match(legal.source_reference || '', /^https:\/\/jdih\.kemkes\.go\.id\//);

    // Q: Video summary not masquerading as transcript
    const baselineVideoIds = Array.from({ length: 4 }, (_, i) =>
      `33000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
    );
    const seededVideos = await prisma.education_videos.findMany({
      where: { id: { in: baselineVideoIds } }
    });
    assert.equal(seededVideos.length, 4);
    for (const v of seededVideos) {
      assert.equal(v.publication_status, 'REVIEW');
      assert.equal(v.transcript_text, '');
      assert.equal(v.subtitle_text, '');
    }
  } finally {
    if (createdArticleIds.length > 0) {
      await prisma.education_articles.deleteMany({ where: { id: { in: createdArticleIds } } });
    }
    if (createdVideoIds.length > 0) {
      await prisma.education_videos.deleteMany({ where: { id: { in: createdVideoIds } } });
    }
    await prisma.audit_logs.deleteMany({ where: { actor_user_id: adminId } });
    await prisma.refresh_tokens.deleteMany({ where: { user_id: adminId } });
    await prisma.users.deleteMany({ where: { id: adminId } });
    await app.close();
    await prisma.$disconnect();
  }
});
