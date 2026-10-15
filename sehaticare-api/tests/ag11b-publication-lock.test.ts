import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { computeArticleContentHash } from '../src/modules/publicContent/contentReview.service';
import { runVerifiedContentSeed } from '../prisma/seed-verified-content';

test('AG-11B publication review lock, clinical reviewer verification, and revision invalidation (Cases A-V)', async () => {
  const app = await buildApp();
  const marker = randomUUID();
  const passwordHash = await bcrypt.hash('Ag11b-SecurePass-2026', 12);

  // User IDs
  const adminId = randomUUID();
  const verifiedDoctorId = randomUUID();
  const unverifiedDoctorId = randomUUID();
  const patientId = randomUUID();
  const counselorId = randomUUID();

  const userIds = [adminId, verifiedDoctorId, unverifiedDoctorId, patientId, counselorId];
  const createdArticleIds: string[] = [];

  let adminHeaders: Record<string, string> = {};
  let verifiedDoctorHeaders: Record<string, string> = {};
  let unverifiedDoctorHeaders: Record<string, string> = {};
  let patientHeaders: Record<string, string> = {};
  let counselorHeaders: Record<string, string> = {};

  try {
    // Setup users
    // 1. ADMIN
    await prisma.users.create({
      data: {
        id: adminId,
        email: `admin-ag11b-${marker}@example.test`,
        full_name: 'Admin Tata Kelola Konten AG11B',
        role: 'ADMIN',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });

    // 2. VERIFIED DOKTER
    await prisma.users.create({
      data: {
        id: verifiedDoctorId,
        email: `doctor-verified-${marker}@example.test`,
        full_name: 'dr. Siti Rahmawati Sp.PD AG11B',
        role: 'DOKTER',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });
    await prisma.doctor_profiles.create({
      data: {
        user_id: verifiedDoctorId,
        verification_status: 'VERIFIED',
        verified_at: new Date(),
        puskesmas_name: 'Puskesmas Tebet',
        str_number: 'STR-VERIFIED-AG11B-001',
        updated_at: new Date()
      }
    });

    // 3. UNVERIFIED DOKTER
    await prisma.users.create({
      data: {
        id: unverifiedDoctorId,
        email: `doctor-unverified-${marker}@example.test`,
        full_name: 'dr. Budi Belum Terverifikasi AG11B',
        role: 'DOKTER',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });
    await prisma.doctor_profiles.create({
      data: {
        user_id: unverifiedDoctorId,
        verification_status: 'PENDING',
        puskesmas_name: 'Puskesmas Senen',
        str_number: 'STR-UNVERIFIED-AG11B-002',
        updated_at: new Date()
      }
    });

    // 4. PASIEN
    await prisma.users.create({
      data: {
        id: patientId,
        email: `patient-${marker}@example.test`,
        full_name: 'Pasien Edukasi AG11B',
        role: 'PASIEN',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });

    // 5. COUNSELOR
    await prisma.users.create({
      data: {
        id: counselorId,
        email: `counselor-${marker}@example.test`,
        full_name: 'Konselor Sebaya AG11B',
        role: 'COUNSELOR',
        password_hash: passwordHash,
        is_active: true,
        updated_at: new Date()
      }
    });

    // Login each user to obtain tokens
    const login = async (email: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'Ag11b-SecurePass-2026' }
      });
      assert.equal(res.statusCode, 200, `Login failed for ${email}`);
      return { authorization: `Bearer ${res.json().access_token}` };
    };

    adminHeaders = await login(`admin-ag11b-${marker}@example.test`);
    verifiedDoctorHeaders = await login(`doctor-verified-${marker}@example.test`);
    unverifiedDoctorHeaders = await login(`doctor-unverified-${marker}@example.test`);
    patientHeaders = await login(`patient-${marker}@example.test`);
    counselorHeaders = await login(`counselor-${marker}@example.test`);

    const category = await prisma.content_categories.findFirst({ where: { slug: 'dasar-hiv' } });
    assert.ok(category, 'Category dasar-hiv must exist');

    const baseArticleTitle = `Pencegahan Penularan HIV Ibu ke Anak ${marker.slice(0, 8)}`;
    const createArticleRes = await app.inject({
      method: 'POST',
      url: '/admin/content/articles',
      headers: adminHeaders,
      payload: {
        title: baseArticleTitle,
        slug: `pencegahan-hiv-ibu-anak-${marker}`,
        summary: 'Panduan medis komprehensif pencegahan transmisi vertikal HIV menurut pedoman Kemenkes RI.',
        body_markdown: 'Terapi antiretroviral (ARV) selama masa kehamilan terbukti menurunkan risiko penularan hingga di bawah 1 persen.',
        category_id: category.id,
        language: 'id',
        source_reference: 'https://kemkes.go.id/id/profil-kesehatan-indonesia-2024-pedoman-hiv',
        reading_minutes: 3,
        featured: false
      }
    });
    assert.equal(createArticleRes.statusCode, 201);
    const article = createArticleRes.json();
    createdArticleIds.push(article.id);

    // Initial state: DRAFT
    const initialGet = await app.inject({
      method: 'GET',
      url: `/admin/content/articles/${article.id}`,
      headers: adminHeaders
    });
    assert.equal(initialGet.json().publication_status, 'DRAFT');
    assert.equal(initialGet.json().is_published, false);
    assert.equal(initialGet.json().is_clinically_approved, false);

    // =========================================================================
    // Case A: ADMIN direct DRAFT -> PUBLISHED rejected
    // =========================================================================
    const draftPublishAttempt = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(draftPublishAttempt.statusCode, 400);
    assert.match(draftPublishAttempt.json().message, /DRAFT tidak dapat langsung diterbitkan/i);

    // Admin moves article to REVIEW
    const moveToReview = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}/status`,
      headers: adminHeaders,
      payload: { status: 'REVIEW' }
    });
    assert.equal(moveToReview.statusCode, 200);
    assert.equal(moveToReview.json().status, 'REVIEW');

    // =========================================================================
    // Case B: ADMIN REVIEW -> PUBLISHED without clinical approval rejected
    // =========================================================================
    const reviewPublishWithoutApproval = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(reviewPublishWithoutApproval.statusCode, 400);
    assert.match(reviewPublishWithoutApproval.json().message, /persetujuan klinis dokter terverifikasi/i);

    // Doctor inspects article and obtains server canonical hash
    const doctorInspect = await app.inject({
      method: 'GET',
      url: `/doctor/content-reviews/${article.id}`,
      headers: verifiedDoctorHeaders
    });
    assert.equal(doctorInspect.statusCode, 200);
    const canonicalHash = doctorInspect.json().current_content_hash;
    assert.ok(canonicalHash, 'Canonical hash must be returned');

    // =========================================================================
    // Case C: Unverified DOKTER approval rejected (403)
    // =========================================================================
    const unverifiedApprovalAttempt = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article.id}`,
      headers: unverifiedDoctorHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: canonicalHash,
        notes: 'Mencoba menyetujui tanpa verifikasi profil'
      }
    });
    assert.equal(unverifiedApprovalAttempt.statusCode, 403);
    assert.match(unverifiedApprovalAttempt.json().message, /belum terverifikasi/i);

    // =========================================================================
    // Case E: PASIEN approval rejected (403)
    // =========================================================================
    const patientApprovalAttempt = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article.id}`,
      headers: patientHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: canonicalHash
      }
    });
    assert.equal(patientApprovalAttempt.statusCode, 403);

    // =========================================================================
    // Case F: COUNSELOR approval rejected (403)
    // =========================================================================
    const counselorApprovalAttempt = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article.id}`,
      headers: counselorHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: canonicalHash
      }
    });
    assert.equal(counselorApprovalAttempt.statusCode, 403);

    // =========================================================================
    // Case G: ADMIN-only approval rejected (403 - doctor route requires doctor role)
    // =========================================================================
    const adminApprovalAttempt = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article.id}`,
      headers: adminHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: canonicalHash
      }
    });
    assert.equal(adminApprovalAttempt.statusCode, 403);

    // Attempt approval with wrong hash should be rejected (409)
    const wrongHashAttempt = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article.id}`,
      headers: verifiedDoctorHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        notes: 'Hash salah'
      }
    });
    assert.equal(wrongHashAttempt.statusCode, 409);
    assert.match(wrongHashAttempt.json().message, /berubah sejak dimuat/i);

    // =========================================================================
    // Case D, H, L, U: Active verified DOKTER approval succeeds (201)
    // =========================================================================
    const reviewNoteText = 'Sesuai pedoman tatalaksana pencegahan penularan HIV vertikal Kemenkes RI 2024.';
    const validApprovalRes = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article.id}`,
      headers: verifiedDoctorHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: canonicalHash,
        notes: reviewNoteText
      }
    });
    assert.equal(validApprovalRes.statusCode, 201);
    const approvalData = validApprovalRes.json();
    assert.equal(approvalData.decision, 'APPROVED');
    assert.equal(approvalData.content_hash, canonicalHash);

    // Verify reviewer_id and review notes persisted (Case L & U)
    const reviewRecord = await prisma.article_clinical_reviews.findUnique({
      where: { id: approvalData.id }
    });
    assert.ok(reviewRecord);
    assert.equal(reviewRecord.reviewer_id, verifiedDoctorId);
    assert.equal(reviewRecord.notes, reviewNoteText);

    // Admin views article: should show is_clinically_approved: true
    const adminInspectApproved = await app.inject({
      method: 'GET',
      url: `/admin/content/articles/${article.id}`,
      headers: adminHeaders
    });
    assert.equal(adminInspectApproved.json().is_clinically_approved, true);
    assert.equal(adminInspectApproved.json().approved_content_hash, canonicalHash);

    // =========================================================================
    // Case O & M: Approved content can be published by ADMIN, publisher_id recorded
    // =========================================================================
    const publishRes = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishRes.statusCode, 200);
    assert.equal(publishRes.json().status, 'PUBLISHED');

    const publishedRecord = await prisma.education_articles.findUnique({
      where: { id: article.id }
    });
    assert.ok(publishedRecord);
    assert.equal(publishedRecord.publication_status, 'PUBLISHED');
    assert.equal(publishedRecord.is_published, true);
    assert.equal(publishedRecord.publisher_id, adminId); // Case M: publisher_id recorded separately
    assert.equal(publishedRecord.reviewer_id, verifiedDoctorId); // Reviewer ID preserved

    // =========================================================================
    // Case N: Audit logs recorded for both approval and publication
    // =========================================================================
    const approvalAudit = await prisma.audit_logs.findFirst({
      where: {
        actor_user_id: verifiedDoctorId,
        action: 'ARTICLE_CLINICAL_REVIEW',
        entity_id: article.id
      }
    });
    assert.ok(approvalAudit, 'ARTICLE_CLINICAL_REVIEW audit log must exist');

    const publicationAudit = await prisma.audit_logs.findFirst({
      where: {
        actor_user_id: adminId,
        action: 'ARTICLE_PUBLISHED',
        entity_id: article.id
      }
    });
    assert.ok(publicationAudit, 'ARTICLE_PUBLISHED audit log must exist');

    // =========================================================================
    // Case P: Public API serves only PUBLISHED content
    // =========================================================================
    const publicPublishedRes = await app.inject({
      method: 'GET',
      url: `/public/articles/${article.slug}`
    });
    assert.equal(publicPublishedRes.statusCode, 200);
    assert.equal(publicPublishedRes.json().title, baseArticleTitle);

    // =========================================================================
    // Case I: Edited content invalidates previous approval & reverts published
    // =========================================================================
    const editPayload = {
      title: `Pencegahan HIV Revisi ${marker.slice(0, 8)}`,
      slug: article.slug,
      summary: 'Ringkasan telah direvisi oleh staf editorial.',
      body_markdown: 'Konten diperbarui dengan data klinis baru yang belum ditelaah ulang oleh dokter.',
      category_id: category.id,
      language: 'id',
      source_reference: 'https://kemkes.go.id/id/profil-kesehatan-indonesia-2024-pedoman-hiv',
      reading_minutes: 4,
      featured: false
    };

    const editRes = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}`,
      headers: adminHeaders,
      payload: editPayload
    });
    assert.equal(editRes.statusCode, 200);
    assert.equal(editRes.json().status, 'REVIEW'); // Reverted to REVIEW
    assert.equal(editRes.json().is_published, false);
    assert.equal(editRes.json().is_clinically_approved, false);

    const editedDbRecord = await prisma.education_articles.findUnique({
      where: { id: article.id }
    });
    assert.ok(editedDbRecord);
    assert.equal(editedDbRecord.publication_status, 'REVIEW');
    assert.equal(editedDbRecord.is_published, false);
    assert.equal(editedDbRecord.approved_content_hash, null);
    assert.equal(editedDbRecord.reviewer_id, null);

    // Public route should now 404 because article is reverted to REVIEW
    const publicPostEdit = await app.inject({
      method: 'GET',
      url: `/public/articles/${article.slug}`
    });
    assert.equal(publicPostEdit.statusCode, 404);

    // =========================================================================
    // Case J: Old approval hash cannot publish edited version
    // =========================================================================
    const publishEditedWithNoNewApproval = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishEditedWithNoNewApproval.statusCode, 400);
    assert.match(publishEditedWithNoNewApproval.json().message, /persetujuan klinis dokter terverifikasi/i);

    // =========================================================================
    // Case K: Concurrent edit and publish cannot bypass review
    // =========================================================================
    // Doctor approves the edited version
    const newCanonicalHash = computeArticleContentHash({
      title: editPayload.title,
      summary: editPayload.summary,
      body_markdown: editPayload.body_markdown,
      category_id: editPayload.category_id,
      language: editPayload.language,
      source_reference: editPayload.source_reference
    });

    const secondApproval = await app.inject({
      method: 'POST',
      url: `/doctor/content-reviews/${article.id}`,
      headers: verifiedDoctorHeaders,
      payload: {
        decision: 'APPROVED',
        content_hash: newCanonicalHash,
        notes: 'Telaah medis versi revisi disetujui.'
      }
    });
    assert.equal(secondApproval.statusCode, 201);

    // Simulate concurrent mutation in DB right before publish transaction checks
    // We intentionally modify updated_at and body in the database
    await prisma.education_articles.update({
      where: { id: article.id },
      data: {
        body_markdown: 'Modifikasi liar tanpa telaah dokter setelah persetujuan.',
        updated_at: new Date(Date.now() + 5000)
      }
    });

    const concurrentPublishAttempt = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(concurrentPublishAttempt.statusCode, 400); // Fails approval check because hash no longer matches current DB content

    // =========================================================================
    // Case T: Revoking doctor verification invalidates future publishing
    // =========================================================================
    // Restore article to exact state approved by secondApproval
    await prisma.education_articles.update({
      where: { id: article.id },
      data: {
        body_markdown: editPayload.body_markdown,
        approved_content_hash: newCanonicalHash,
        reviewer_id: verifiedDoctorId,
        updated_at: new Date()
      }
    });

    // Revoke doctor's verification status
    await prisma.doctor_profiles.update({
      where: { user_id: verifiedDoctorId },
      data: { verification_status: 'REJECTED', updated_at: new Date() }
    });

    // Attempt to publish article when reviewer's verification is revoked
    const publishRevokedDoctor = await app.inject({
      method: 'PUT',
      url: `/admin/content/articles/${article.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishRevokedDoctor.statusCode, 403);
    assert.match(publishRevokedDoctor.json().message, /verifikasi profesi dokter penelaah tidak terverifikasi/i);

    // Restore doctor verification for cleanup
    await prisma.doctor_profiles.update({
      where: { user_id: verifiedDoctorId },
      data: { verification_status: 'VERIFIED', updated_at: new Date() }
    });

    // =========================================================================
    // Case Q: Non-reviewed AG-11 articles stay non-public
    // =========================================================================
    const baselineArticle = await prisma.education_articles.findFirst({
      where: { slug: 'memahami-perbedaan-hiv-dan-aids' }
    });
    assert.ok(baselineArticle);
    assert.equal(baselineArticle.publication_status, 'REVIEW');
    assert.equal(baselineArticle.is_published, false);
    assert.equal(baselineArticle.approved_content_hash, null);

    const publicBaselineArticle = await app.inject({
      method: 'GET',
      url: '/public/articles/memahami-perbedaan-hiv-dan-aids'
    });
    assert.equal(publicBaselineArticle.statusCode, 404);

    // =========================================================================
    // Case R: Non-reviewed AG-11 videos stay non-public
    // =========================================================================
    const baselineVideos = await prisma.education_videos.findMany({
      where: { publication_status: 'REVIEW' }
    });
    assert.ok(baselineVideos.length >= 4);

    const publicVideosList = await app.inject({
      method: 'GET',
      url: '/public/videos'
    });
    assert.equal(publicVideosList.statusCode, 200);
    const publicVideoItems = publicVideosList.json().items;
    for (const vid of baselineVideos) {
      const foundInPublic = publicVideoItems.some((v: any) => v.id === vid.id);
      assert.equal(foundInPublic, false, `Video ${vid.id} must not appear in public API`);
    }

    // =========================================================================
    // Case S: Idempotent seed preserves unreviewed state
    // =========================================================================
    const seedResult1 = await runVerifiedContentSeed();
    assert.equal(seedResult1.articles.preserved, 16);
    assert.equal(seedResult1.articles.conflicts, 0);
    assert.equal(seedResult1.videos.preserved, 4);

    const seedResult2 = await runVerifiedContentSeed();
    assert.equal(seedResult2.articles.preserved, 16);
    assert.equal(seedResult2.articles.conflicts, 0);
    assert.equal(seedResult2.videos.preserved, 4);

    // Verify all 16 articles remain in REVIEW without manufactured approvals
    const all16 = await prisma.education_articles.findMany({
      where: {
        id: {
          in: Array.from({ length: 16 }, (_, i) =>
            `32000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
          )
        }
      }
    });
    assert.equal(all16.length, 16);
    for (const art of all16) {
      assert.equal(art.publication_status, 'REVIEW');
      assert.equal(art.is_published, false);
      assert.equal(art.approved_content_hash, null);
    }

    // =========================================================================
    // Case V: Unrelated clinical records remain inaccessible
    // =========================================================================
    // Doctor review endpoint must NOT expose consultations, voice notes, or patient clinical records
    const doctorArticleDetail = await app.inject({
      method: 'GET',
      url: `/doctor/content-reviews/${article.id}`,
      headers: verifiedDoctorHeaders
    });
    assert.equal(doctorArticleDetail.statusCode, 200);
    const bodyKeys = Object.keys(doctorArticleDetail.json());
    assert.equal(bodyKeys.includes('consultations'), false);
    assert.equal(bodyKeys.includes('patient'), false);
    assert.equal(bodyKeys.includes('patients'), false);
    assert.equal(bodyKeys.includes('clinical_records'), false);
  } finally {
    if (createdArticleIds.length > 0) {
      await prisma.article_clinical_reviews.deleteMany({ where: { article_id: { in: createdArticleIds } } });
      await prisma.education_articles.deleteMany({ where: { id: { in: createdArticleIds } } });
    }
    await prisma.audit_logs.deleteMany({ where: { actor_user_id: { in: userIds } } });
    await prisma.doctor_profiles.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.refresh_tokens.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
    await prisma.$disconnect();
  }
});
