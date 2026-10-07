import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { assertStorageReady } from '../src/modules/voiceNotes/storage.service';

test('PostgreSQL + MinIO counselor self-application can be submitted, verified, and activated separately', async () => {
  await assertStorageReady();
  const now = new Date();
  const counselor = await prisma.users.upsert({
    where: { email: 'data-uji-finalisasi-konselor@sehaticare.local' },
    update: { role: 'COUNSELOR', is_active: true, full_name: '[DATA UJI] Calon Konselor Finalisasi', updated_at: now },
    create: { id: randomUUID(), email: 'data-uji-finalisasi-konselor@sehaticare.local', full_name: '[DATA UJI] Calon Konselor Finalisasi', role: 'COUNSELOR', account_mode: 'LEGACY', is_active: true, updated_at: now }
  });
  const admin = await prisma.users.upsert({
    where: { email: 'data-uji-finalisasi-admin@sehaticare.local' },
    update: { role: 'ADMIN', is_active: true, full_name: '[DATA UJI] Admin Finalisasi', updated_at: now },
    create: { id: randomUUID(), email: 'data-uji-finalisasi-admin@sehaticare.local', full_name: '[DATA UJI] Admin Finalisasi', role: 'ADMIN', account_mode: 'LEGACY', is_active: true, updated_at: now }
  });
  const doctor = await prisma.users.upsert({
    where: { email: 'data-uji-finalisasi-dokter@sehaticare.local' },
    update: { role: 'DOKTER', is_active: true, full_name: '[DATA UJI] Dokter Lama Finalisasi', updated_at: now },
    create: { id: randomUUID(), email: 'data-uji-finalisasi-dokter@sehaticare.local', full_name: '[DATA UJI] Dokter Lama Finalisasi', role: 'DOKTER', account_mode: 'LEGACY', is_active: true, updated_at: now }
  });
  const previous = await prisma.counselor_applications.findUnique({ where: { user_id: counselor.id } });
  if (previous) await prisma.counselor_applications.update({ where: { id: previous.id }, data: { status: 'DRAFT', revision_notes: null, rejection_reason: null, updated_at: now } });
  const previousDoctor = await prisma.counselor_applications.findUnique({ where: { user_id: doctor.id } });
  if (previousDoctor) await prisma.counselor_applications.update({ where: { id: previousDoctor.id }, data: { status: 'DRAFT', revision_notes: null, rejection_reason: null, updated_at: now } });
  await prisma.counselor_profiles.updateMany({ where: { user_id: counselor.id }, data: { permission_enabled: false, is_active: false, is_available: false, updated_at: now } });

  const app = await buildApp();
  await app.ready();
  try {
    const counselorToken = app.auth.signAccessToken({ userId: counselor.id, role: 'COUNSELOR', sessionVersion: counselor.session_version });
    const adminToken = app.auth.signAccessToken({ userId: admin.id, role: 'ADMIN', sessionVersion: admin.session_version });
    const doctorToken = app.auth.signAccessToken({ userId: doctor.id, role: 'DOKTER', sessionVersion: doctor.session_version });
    const auth = (token: string) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });
    const profile = {
      professional_name: '[DATA UJI] Konselor Workflow', profession: 'Konselor', license_number: 'DATA-UJI-ONLY',
      competencies: ['EMOTIONAL_SUPPORT'], languages: ['Bahasa Indonesia'], active_days: [1,2,3,4,5],
      opens_at: '08:00', closes_at: '16:00', timezone: 'Asia/Jayapura',
      applicant_notes: 'DATA UJI otomatis; bukan data profesional nyata.'
    };
    const saved = await app.inject({ method: 'PUT', url: '/counselor-applications/me', headers: auth(counselorToken), payload: profile });
    assert.equal(saved.statusCode, 200, saved.body);
    const pdf = Buffer.from('%PDF-1.4\n% DATA UJI\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const metadata = { document_type: 'PROFESSIONAL_LICENSE', content_type: 'application/pdf', file_size_bytes: pdf.length };
    const upload = await app.inject({ method: 'POST', url: '/counselor-applications/me/documents/upload-url', headers: auth(counselorToken), payload: metadata });
    assert.equal(upload.statusCode, 200, upload.body);
    const uploadBody = upload.json();
    const put = await fetch(uploadBody.upload_url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf });
    assert.equal(put.ok, true, await put.text());
    const commit = await app.inject({ method: 'POST', url: '/counselor-applications/me/documents/commit', headers: auth(counselorToken), payload: { ...metadata, upload_session_id: uploadBody.upload_session_id } });
    assert.equal(commit.statusCode, 201, commit.body);
    const foreignUser = await prisma.users.findFirstOrThrow({ where: { role: 'PASIEN', is_active: true }, select: { id: true, role: true, session_version: true } });
    const foreignToken = app.auth.signAccessToken({ userId: foreignUser.id, role: foreignUser.role, sessionVersion: foreignUser.session_version });
    const forbiddenDocument = await app.inject({ method: 'GET', url: `/counselor-documents/${commit.json().public_id}`, headers: auth(foreignToken) });
    assert.equal(forbiddenDocument.statusCode, 404);
    const submitted = await app.inject({ method: 'POST', url: '/counselor-applications/me/submit', headers: auth(counselorToken), payload: {} });
    assert.equal(submitted.statusCode, 200, submitted.body);
    const self = await app.inject({ method: 'GET', url: '/counselor-applications/me', headers: auth(counselorToken) });
    const applicationId = self.json().application.public_id;
    const review = await app.inject({ method: 'POST', url: `/admin/counselor-applications/${applicationId}/transition`, headers: auth(adminToken), payload: { action: 'START_REVIEW' } });
    assert.equal(review.statusCode, 200, review.body);
    const revision = await app.inject({ method: 'POST', url: `/admin/counselor-applications/${applicationId}/transition`, headers: auth(adminToken), payload: { action: 'REQUEST_REVISION', reason: 'DATA UJI: perjelas catatan kompetensi.' } });
    assert.equal(revision.statusCode, 200, revision.body);
    const corrected = await app.inject({ method: 'PUT', url: '/counselor-applications/me', headers: auth(counselorToken), payload: { ...profile, applicant_notes: 'DATA UJI diperbaiki sesuai catatan reviewer.' } });
    assert.equal(corrected.statusCode, 200, corrected.body);
    const resubmitted = await app.inject({ method: 'POST', url: '/counselor-applications/me/submit', headers: auth(counselorToken), payload: {} });
    assert.equal(resubmitted.statusCode, 200, resubmitted.body);
    for (const action of ['START_REVIEW', 'VERIFY']) {
      const response = await app.inject({ method: 'POST', url: `/admin/counselor-applications/${applicationId}/transition`, headers: auth(adminToken), payload: { action } });
      assert.equal(response.statusCode, 200, response.body);
    }
    const verifiedGate = await app.inject({ method: 'GET', url: '/counselor/profile/me', headers: auth(counselorToken) });
    assert.equal(verifiedGate.json().enabled, false, 'VERIFIED must remain distinct from ACTIVE');
    const activated = await app.inject({ method: 'POST', url: `/admin/counselor-applications/${applicationId}/transition`, headers: auth(adminToken), payload: { action: 'ACTIVATE' } });
    assert.equal(activated.statusCode, 200, activated.body);
    const activeGate = await app.inject({ method: 'GET', url: '/counselor/profile/me', headers: auth(counselorToken) });
    assert.equal(activeGate.json().enabled, true);
    for (const [action, reason, expected] of [
      ['DEACTIVATE', 'DATA UJI: penonaktifan administratif.', false],
      ['ACTIVATE', undefined, true],
      ['SUSPEND', 'DATA UJI: pemeriksaan kepatuhan sementara.', false],
      ['REACTIVATE', undefined, true]
    ] as const) {
      const transitioned = await app.inject({ method: 'POST', url: `/admin/counselor-applications/${applicationId}/transition`, headers: auth(adminToken), payload: { action, ...(reason ? { reason } : {}) } });
      assert.equal(transitioned.statusCode, 200, transitioned.body);
      const gate = await app.inject({ method: 'GET', url: '/counselor/profile/me', headers: auth(counselorToken) });
      assert.equal(gate.json().enabled, expected, `${action} gate mismatch`);
    }
    const doctorDraft = await app.inject({ method: 'PUT', url: '/counselor-applications/me', headers: auth(doctorToken), payload: { ...profile, professional_name: '[DATA UJI] dr. Akun Lama' } });
    assert.equal(doctorDraft.statusCode, 200, doctorDraft.body);
    assert.equal(doctorDraft.json().application.status, 'DRAFT');
    const stored = await prisma.counselor_applications.findUniqueOrThrow({ where: { public_id: applicationId }, include: { review_events: true, status_history: true, documents: true } });
    assert.equal(stored.status, 'ACTIVE');
    assert.ok(stored.documents.length >= 1);
    assert.ok(stored.review_events.some((event) => event.action === 'VERIFY'));
    assert.ok(stored.status_history.some((event) => event.to_status === 'ACTIVE'));
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});
