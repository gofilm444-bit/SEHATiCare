import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-11 content governance: CMS source_reference publishing gate, anti-stigma standards, and category queries', async () => {
  const app = await buildApp();
  const marker = randomUUID();
  const adminId = randomUUID();
  const adminEmail = `admin-ag11-${marker}@example.test`;
  const createdArticleIds: string[] = [];

  try {
    // 1. Setup Admin user
    await prisma.users.create({
      data: {
        id: adminId,
        email: adminEmail,
        full_name: 'Admin AG11 Governance',
        role: 'ADMIN',
        password_hash: await bcrypt.hash('Admin-ag11-pass-2026', 12),
        updated_at: new Date()
      }
    });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: adminEmail, password: 'Admin-ag11-pass-2026' }
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminToken = adminLogin.json().access_token;
    const adminHeaders = { authorization: `Bearer ${adminToken}` };

    // 2. Test CMS Gate: Cannot publish an article without source_reference
    const category = await prisma.content_categories.findFirst({ where: { slug: 'dasar-hiv' } });
    assert.ok(category, 'Category dasar-hiv must exist');

    const draftRes = await app.inject({
      method: 'POST',
      url: '/admin/content/articles',
      headers: adminHeaders,
      payload: {
        title: `Uji Draf Tanpa Sumber ${marker.slice(0, 8)}`,
        slug: `uji-draf-tanpa-sumber-${marker}`,
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

    // Attempt to publish without source_reference -> must return 400
    const failPublishRes = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(failPublishRes.statusCode, 400);
    assert.match(failPublishRes.json().message, /source reference required/i);

    // Update with valid source_reference
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}`,
      headers: adminHeaders,
      payload: {
        title: `Uji Draf Dengan Sumber ${marker.slice(0, 8)}`,
        slug: `uji-draf-tanpa-sumber-${marker}`,
        summary: 'Ringkasan artikel uji draf dengan referensi resmi',
        body_markdown: 'Konten edukasi terverifikasi.',
        category_id: category.id,
        language: 'id',
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 2,
        featured: false
      }
    });
    assert.equal(updateRes.statusCode, 200);

    // Now publishing must succeed (200)
    const successPublishRes = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${draftArticle.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(successPublishRes.statusCode, 200);
    assert.equal(successPublishRes.json().status, 'PUBLISHED');

    // 3. Verify public articles list and categories
    const categoriesRes = await app.inject({ method: 'GET', url: '/public/content-categories' });
    assert.equal(categoriesRes.statusCode, 200);
    const categorySlugs = categoriesRes.json().items.map((c: { slug: string }) => c.slug);
    assert.ok(categorySlugs.includes('dasar-hiv'));
    assert.ok(categorySlugs.includes('pencegahan-dan-tes'));
    assert.ok(categorySlugs.includes('pengobatan-hiv'));
    assert.ok(categorySlugs.includes('dukungan-psikososial'));
    assert.ok(categorySlugs.includes('hak-dan-layanan'));

    // 4. Verify category filtering on /public/articles
    const hakArticlesRes = await app.inject({
      method: 'GET',
      url: '/public/articles?category=hak-dan-layanan'
    });
    assert.equal(hakArticlesRes.statusCode, 200);
    const hakArticles = hakArticlesRes.json().items;
    assert.ok(hakArticles.length >= 2, 'Expected at least 2 articles under hak-dan-layanan');
    for (const item of hakArticles) {
      assert.equal(item.content_categories.slug, 'hak-dan-layanan');
    }

    // 5. Verify authoritative content and anti-stigma text across seeded articles
    const legalArticleRes = await app.inject({
      method: 'GET',
      url: '/public/articles/hak-pasien-dan-kerahasiaan-medis'
    });
    assert.equal(legalArticleRes.statusCode, 200);
    const legalArticle = legalArticleRes.json();
    assert.match(legalArticle.body_markdown, /Undang-Undang Nomor 17 Tahun 2023/);
    assert.match(legalArticle.body_markdown, /(?:Peraturan Menteri Kesehatan|Permenkes) (?:Nomor|No\.) 24 Tahun 2022/);
    assert.match(legalArticle.body_markdown, /(?:Peraturan Menteri Kesehatan|Permenkes) (?:Nomor|No\.) 3 Tahun 2026/);
    assert.doesNotMatch(legalArticle.body_markdown, /Permenkes No\. 21 Tahun 2013/);
    assert.match(legalArticle.body_markdown, /tidak memberikan janji perlindungan absolut yang melampaui ketentuan hukum/i);

    // Verify composite peer story has transparent educational disclaimer
    const compositeRes = await app.inject({
      method: 'GET',
      url: '/public/articles/ilustrasi-komposit-perjalanan-menuju-u-equals-u'
    });
    assert.equal(compositeRes.statusCode, 200);
    const compositeArticle = compositeRes.json();
    assert.match(compositeArticle.body_markdown, /Ilustrasi Komposit Edukatif/i);
    assert.match(compositeArticle.body_markdown, /Tidak ada nama asli, data pribadi, atau identitas individu nyata/i);

    // Verify U=U article defines undetectable viral load criteria accurately
    const uEqualsURes = await app.inject({
      method: 'GET',
      url: '/public/articles/arv-viral-load-dan-u-equals-u'
    });
    assert.equal(uEqualsURes.statusCode, 200);
    const uArticle = uEqualsURes.json();
    assert.match(uArticle.body_markdown, /Undetectable = Untransmittable/i);
    assert.match(uArticle.body_markdown, /<200 kopi\/mL/);
    assert.match(uArticle.body_markdown, /minimal selama 6 bulan/i);
    assert.match(uArticle.body_markdown, /TIDAK melindungi dari infeksi menular seksual/i);

    // Verify PEP article defines 72-hour window and 28-day duration
    const pepRes = await app.inject({
      method: 'GET',
      url: '/public/articles/pep-profilaksis-pasca-paparan-darurat'
    });
    assert.equal(pepRes.statusCode, 200);
    const pepArticle = pepRes.json();
    assert.match(pepArticle.body_markdown, /72 jam/i);
    assert.match(pepArticle.body_markdown, /28 hari/i);

    // Verify PrEP article defines negative status requirement and kidney monitoring
    const prepRes = await app.inject({
      method: 'GET',
      url: '/public/articles/mengenal-prep-pencegahan-sebelum-paparan'
    });
    assert.equal(prepRes.statusCode, 200);
    const prepArticle = prepRes.json();
    assert.match(prepArticle.body_markdown, /HIV negatif/i);
    assert.match(prepArticle.body_markdown, /ginjal/i);

    // Verify offline-safe header is present on public articles response
    assert.equal(hakArticlesRes.headers['x-sehaticare-offline-safe'], '1');
    assert.match(hakArticlesRes.headers['cache-control'] || '', /public/);
  } finally {
    if (createdArticleIds.length > 0) {
      await prisma.education_articles.deleteMany({ where: { id: { in: createdArticleIds } } });
    }
    await prisma.audit_logs.deleteMany({ where: { actor_user_id: adminId } });
    await prisma.refresh_tokens.deleteMany({ where: { user_id: adminId } });
    await prisma.users.deleteMany({ where: { id: adminId } });
    await app.close();
    await prisma.$disconnect();
  }
});
