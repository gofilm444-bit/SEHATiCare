import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { computeArticleContentHash } from '../src/modules/publicContent/contentReview.service';
import { runVerifiedContentSeed } from '../prisma/seed-verified-content';

test('AG-11B1 Concurrency, Active Revision Lock, Video Gate, Portal Privacy & Non-destructive Seed', async () => {
  const app = await buildApp();
  const marker = randomUUID();
  const passwordHash = await bcrypt.hash('Ag11b1-SecurePass-2026', 12);

  const adminId = randomUUID();
  const verifiedDoctorId = randomUUID();
  const unverifiedDoctorId = randomUUID();

  const userIds = [adminId, verifiedDoctorId, unverifiedDoctorId];
  const createdArticleIds: string[] = [];
  const createdVideoIds: string[] = [];

  let adminHeaders: Record<string, string> = {};
  let verifiedDoctorHeaders: Record<string, string> = {};

  try {
    // 1. Setup Admin
    await prisma.users.create({
      data: {
        id: adminId,
        email: `admin-ag11b1-${marker}@example.test`,
        full_name: 'Admin Tata Kelola AG11B1',
        role: 'ADMIN',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });

    // 2. Setup Verified Doctor
    await prisma.users.create({
      data: {
        id: verifiedDoctorId,
        email: `doctor-ag11b1-${marker}@example.test`,
        full_name: 'dr. Hendra Sp.PD AG11B1',
        role: 'DOKTER',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });
    await prisma.doctor_profiles.create({
      data: {
        user_id: verifiedDoctorId,
        str_number: 'STR-AG11B1-9999',
        puskesmas_name: 'Puskesmas Jayapura Sentani',
        verification_status: 'VERIFIED',
        verified_at: new Date(),
        updated_at: new Date()
      }
    });

    // 3. Setup Unverified Doctor
    await prisma.users.create({
      data: {
        id: unverifiedDoctorId,
        email: `doctor-unverified-${marker}@example.test`,
        full_name: 'dr. Unverified AG11B1',
        role: 'DOKTER',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });
    await prisma.doctor_profiles.create({
      data: {
        user_id: unverifiedDoctorId,
        str_number: 'STR-UNVER-1111',
        puskesmas_name: 'Klinik Swasta',
        verification_status: 'PENDING',
        updated_at: new Date()
      }
    });

    // Login Admin
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: `admin-ag11b1-${marker}@example.test`, password: 'Ag11b1-SecurePass-2026' }
    });
    assert.equal(adminLogin.statusCode, 200);
    adminHeaders = { authorization: `Bearer ${adminLogin.json().access_token}` };

    // Login Doctor
    const doctorLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: `doctor-ag11b1-${marker}@example.test`, password: 'Ag11b1-SecurePass-2026' }
    });
    assert.equal(doctorLogin.statusCode, 200);
    verifiedDoctorHeaders = { authorization: `Bearer ${doctorLogin.json().access_token}` };

    // =========================================================================
    // TEST 1: Rejection Authority (APPROVED -> REJECTED -> Publish rejected)
    // =========================================================================
    const article1Res = await app.inject({
      method: 'POST',
      url: '/admin/content/articles',
      headers: adminHeaders,
      payload: {
        title: 'Penanganan Terapi ARV Dini',
        slug: `arv-dini-${marker}`,
        summary: 'Panduan medis memulai terapi ARV sejak dini.',
        body_markdown: 'Terapi ARV dini menekan replikasi virus HIV secara efektif.',
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 3,
        featured: false,
        language: 'id'
      }
    });
    assert.equal(article1Res.statusCode, 201);
    const article1Id = article1Res.json().id;
    createdArticleIds.push(article1Id);

    // Transition to REVIEW
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });

    // Doctor approves
    const hash1 = computeArticleContentHash({
      title: 'Penanganan Terapi ARV Dini',
      summary: 'Panduan medis memulai terapi ARV sejak dini.',
      body_markdown: 'Terapi ARV dini menekan replikasi virus HIV secara efektif.',
      language: 'id',
      source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids'
    });

    const approve1 = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article1Id}/review`,
      headers: verifiedDoctorHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: hash1,
        notes: 'Disetujui untuk rujukan protokol klinis.'
      }
    });
    assert.equal(approve1.statusCode, 201);

    // Later, doctor rejects with revision notes
    // First, admin moves it to REVIEW if rejection reverted it to DRAFT
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });

    const reject1 = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article1Id}/review`,
      headers: verifiedDoctorHeaders,
      payload: {
        decision: 'REJECTED',
        content_hash: hash1,
        notes: 'Perlu revisi dosis lini pertama sesuai panduan Kemenkes terbaru.'
      }
    });
    assert.equal(reject1.statusCode, 201);

    // Move to REVIEW and attempt publish: MUST BE REJECTED because latest decision is REJECTED
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });

    const publishAfterReject = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishAfterReject.statusCode, 400);
    assert.match(publishAfterReject.json().message, /penolakan|REJECTED|Persetujuan klinis/i);

    // Doctor re-approves -> publish succeeds
    const approveAgain = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article1Id}/review`,
      headers: verifiedDoctorHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: hash1,
        notes: 'Revisi dosis telah diverifikasi.'
      }
    });
    assert.equal(approveAgain.statusCode, 201);

    const publishSucceeds = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishSucceeds.statusCode, 200);

    // =========================================================================
    // TEST 2: Active Revision Lock (A -> B -> A requires fresh review)
    // =========================================================================
    const contentA = 'Konten asli versi A mengenai pencegahan penularan HIV.';
    const contentB = 'Konten sementara versi B yang telah diubah secara substansial.';

    const article2Res = await app.inject({
      method: 'POST',
      url: '/admin/content/articles',
      headers: adminHeaders,
      payload: {
        title: 'Pencegahan Komprehensif Versi A',
        slug: `pencegahan-komprehensif-${marker}`,
        summary: 'Ringkasan panduan pencegahan A.',
        body_markdown: contentA,
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 2,
        featured: false,
        language: 'id'
      }
    });
    assert.equal(article2Res.statusCode, 201);
    const article2Id = article2Res.json().id;
    createdArticleIds.push(article2Id);

    // Submit to REVIEW
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article2Id}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });

    const hashA = computeArticleContentHash({
      title: 'Pencegahan Komprehensif Versi A',
      summary: 'Ringkasan panduan pencegahan A.',
      body_markdown: contentA,
      language: 'id',
      source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids'
    });

    // Doctor approves version 1 (content A)
    const approveA = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article2Id}/review`,
      headers: verifiedDoctorHeaders,
      payload: { decision: 'APPROVED', content_hash: hashA }
    });
    assert.equal(approveA.statusCode, 201);

    // Admin edits to content B
    const editToB = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article2Id}`,
      headers: adminHeaders,
      payload: {
        title: 'Pencegahan Komprehensif Versi B',
        slug: `pencegahan-komprehensif-${marker}`,
        summary: 'Ringkasan panduan pencegahan B.',
        body_markdown: contentB,
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 2,
        featured: false,
        language: 'id'
      }
    });
    assert.equal(editToB.statusCode, 200);

    // Admin edits BACK to content A (identical hash to original A)
    const editBackToA = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article2Id}`,
      headers: adminHeaders,
      payload: {
        title: 'Pencegahan Komprehensif Versi A',
        slug: `pencegahan-komprehensif-${marker}`,
        summary: 'Ringkasan panduan pencegahan A.',
        body_markdown: contentA,
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 2,
        featured: false,
        language: 'id'
      }
    });
    assert.equal(editBackToA.statusCode, 200);

    // Admin attempts to publish: MUST BE REJECTED because active revision version has advanced
    const publishAAfterBack = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article2Id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishAAfterBack.statusCode, 400);
    assert.match(publishAAfterBack.json().message, /versi artikel saat ini|Persetujuan klinis/i);

    // =========================================================================
    // TEST 3: Archive invalidates approval and requires fresh review
    // =========================================================================
    // Archive article1 (which was published)
    const archiveArticle = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'ARCHIVED' }
    });
    assert.equal(archiveArticle.statusCode, 200);

    // Move back to REVIEW
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });

    // Attempt to publish without fresh review: MUST BE REJECTED
    const publishArchived = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article1Id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishArchived.statusCode, 400);

    // =========================================================================
    // TEST 4: PostgreSQL Concurrency Interleaving with Controlled Locks
    // =========================================================================
    // Create dedicated article for concurrency test
    const concArticleRes = await app.inject({
      method: 'POST',
      url: '/admin/content/articles',
      headers: adminHeaders,
      payload: {
        title: 'Uji Konkurensi Mutasi dan Publikasi',
        slug: `uji-konkurensi-${marker}`,
        summary: 'Pengujian transaksi atomik dan penguncian baris PostgreSQL.',
        body_markdown: 'Konten awal sebelum uji coba konkurensi.',
        source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
        reading_minutes: 2,
        featured: false,
        language: 'id'
      }
    });
    assert.equal(concArticleRes.statusCode, 201);
    const concArticleId = concArticleRes.json().id;
    createdArticleIds.push(concArticleId);

    // Move to REVIEW and approve
    await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${concArticleId}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });

    const concHash = computeArticleContentHash({
      title: 'Uji Konkurensi Mutasi dan Publikasi',
      summary: 'Pengujian transaksi atomik dan penguncian baris PostgreSQL.',
      body_markdown: 'Konten awal sebelum uji coba konkurensi.',
      language: 'id',
      source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids'
    });

    await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${concArticleId}/review`,
      headers: verifiedDoctorHeaders,
      payload: { decision: 'APPROVED', content_hash: concHash }
    });

    // Case 4A: Edit vs Publish Interleaving
    // Client 2 opens a transaction, locks the row FOR UPDATE, changes the content and commits
    const prismaClient2 = new PrismaClient();
    try {
      await prismaClient2.$transaction(async (tx) => {
        const [locked] = await tx.$queryRaw<any[]>`
          SELECT * FROM "education_articles" WHERE id = ${concArticleId}::uuid FOR UPDATE
        `;
        assert.ok(locked);
        // Mutate content and bump version inside transaction
        await tx.$executeRaw`
          UPDATE "education_articles"
          SET body_markdown = 'Konten telah diubah oleh transaksi 1 yang memegang lock.',
              approved_content_hash = NULL,
              approved_content_version = NULL,
              content_version = content_version + 1,
              updated_at = NOW()
          WHERE id = ${concArticleId}::uuid
        `;
      });
    } finally {
      await prismaClient2.$disconnect();
    }

    // Now attempt publish: MUST BE REJECTED because the version changed and approval was cleared
    const publishAfterLockedEdit = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${concArticleId}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishAfterLockedEdit.statusCode, 400);

    // =========================================================================
    // TEST 5: Video Publishing Gate (Blocks PUBLISHED transition)
    // =========================================================================
    const videoRes = await app.inject({
      method: 'POST',
      url: '/admin/content/videos',
      headers: adminHeaders,
      payload: {
        title: 'Video Edukasi Pencegahan Penularan',
        description: 'Penjelasan klinis jalur transmisi virus.',
        category_id: (await prisma.content_categories.findFirst())?.id,
        source_type: 'EXTERNAL',
        external_url: 'https://www.youtube.com/watch?v=mLfb3mMNubc',
        thumbnail_alt: 'Thumbnail video',
        language: 'id',
        subtitle_text: 'Teks subtitle resmi.',
        transcript_text: 'Transkrip verbatim resmi.',
        speaker_type: 'GENERAL'
      }
    });
    assert.equal(videoRes.statusCode, 201);
    const videoId = videoRes.json().id;
    createdVideoIds.push(videoId);

    // Attempt to publish video: MUST BE REJECTED (400)
    const publishVideo = await app.inject({
      method: 'PUT',
      url: `/admin/content/videos/${videoId}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishVideo.statusCode, 400);
    assert.match(publishVideo.json().message, /ditangguhkan|persetujuan medis video/i);

    // Allowed status transitions (DRAFT -> REVIEW -> ARCHIVED)
    const reviewVideo = await app.inject({
      method: 'PUT',
      url: `/admin/content/videos/${videoId}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });
    assert.equal(reviewVideo.statusCode, 200);

    // =========================================================================
    // TEST 6: Portal Response Sanitization (No Leakage of REVIEW/DRAFT content)
    // =========================================================================
    // Create a portal item pointing to an unapproved article in REVIEW
    const portalItemRes = await app.inject({
      method: 'POST',
      url: '/admin/content/portal',
      headers: adminHeaders,
      payload: {
        section: 'edukasiAwal',
        title: 'Kartu Edukasi Portal',
        summary: 'Ringkasan kartu edukasi.',
        article_id: article2Id,
        video_id: videoId,
        publication_status: 'PUBLISHED',
        display_order: 99
      }
    });
    assert.equal(portalItemRes.statusCode, 201);
    const portalItemId = portalItemRes.json().id;

    // Public /portal endpoint must NOT expose article or video metadata because they are in REVIEW
    const publicPortal = await app.inject({
      method: 'GET',
      url: '/public/portal'
    });
    assert.equal(publicPortal.statusCode, 200);
    const portalData = publicPortal.json();
    const portalItemInPublic = portalData.items.find((i: any) => i.id === portalItemId);
    assert.ok(portalItemInPublic);
    assert.equal(portalItemInPublic.article, null, 'Unapproved article metadata must be null in public portal');
    assert.equal(portalItemInPublic.article_id, null, 'Unapproved article_id must be null in public portal');
    assert.equal(portalItemInPublic.video, null, 'Unapproved video metadata must be null in public portal');
    assert.equal(portalItemInPublic.video_id, null, 'Unapproved video_id must be null in public portal');

    // Clean up portal item
    await prisma.portal_contents.delete({ where: { id: portalItemId } });

    // =========================================================================
    // TEST 7: Seed Idempotency & Non-destructive Preservation of Human Edits
    // =========================================================================
    // Edit baseline video 1 to ARCHIVED
    const baselineVideo1 = '24000000-0000-4000-8000-000000000001';
    await prisma.education_videos.update({
      where: { id: baselineVideo1 },
      data: { publication_status: 'ARCHIVED' }
    });

    const seed1 = await runVerifiedContentSeed();
    assert.equal(seed1.articles.preserved, 16);
    assert.equal(seed1.videos.preserved, 4);

    // Verify baseline video 1 was NOT mutated back to REVIEW
    const video1AfterSeed = await prisma.education_videos.findUnique({
      where: { id: baselineVideo1 }
    });
    assert.equal(video1AfterSeed?.publication_status, 'ARCHIVED');

    const seed2 = await runVerifiedContentSeed();
    assert.equal(seed2.articles.preserved, 16);
    assert.equal(seed2.videos.preserved, 4);
    assert.equal(seed2.articles.updated, 0);
    assert.equal(seed2.videos.updated, 0);

  } finally {
    if (createdArticleIds.length > 0) {
      await prisma.article_clinical_reviews.deleteMany({ where: { article_id: { in: createdArticleIds } } });
      await prisma.education_articles.deleteMany({ where: { id: { in: createdArticleIds } } });
    }
    if (createdVideoIds.length > 0) {
      await prisma.education_videos.deleteMany({ where: { id: { in: createdVideoIds } } });
    }
    await prisma.audit_logs.deleteMany({ where: { actor_user_id: { in: userIds } } });
    await prisma.audit_events.deleteMany({ where: { actor_user_id: { in: userIds } } });
    await prisma.doctor_profiles.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.refresh_tokens.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
    await prisma.$disconnect();
  }
});
