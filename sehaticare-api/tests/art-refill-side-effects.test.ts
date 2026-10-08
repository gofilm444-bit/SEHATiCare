import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-06: ART Side-Effect Notes, Personal Medication Stock & Privacy-Safe Refill Support', async () => {
  const app = await buildApp();
  const marker = randomUUID().slice(0, 8);

  const adminId = randomUUID();
  const patient1Id = randomUUID();
  const patient2Id = randomUUID();
  const doctorAId = randomUUID();
  const doctorBId = randomUUID();
  const companion1Id = randomUUID();
  const companion2Id = randomUUID();

  const passwordHash = await bcrypt.hash('Secure-test-2026!', 12);
  const now = new Date();

  // Region and Facility setup
  let region = await prisma.regions.findFirst();
  if (!region) {
    region = await prisma.regions.create({
      data: {
        id: randomUUID(),
        name: `Papua Refill ${marker}`,
        code: `REG-REF-${marker}`,
        type: 'PROVINCE',
        updated_at: now
      }
    });
  }

  const facility = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Klinik Refill Sehati ${marker}`,
      facility_type: 'PUSKESMAS',
      region_id: region.id,
      address: 'Jl. Sehati Papua No. 6',
      service_hours: '24 Jam',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  // Users
  await prisma.users.createMany({
    data: [
      { id: adminId, email: `admin-ref-${marker}@test.local`, full_name: 'Admin AG06', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
      { id: patient1Id, email: `pat1-ref-${marker}@test.local`, full_name: 'Pasien Satu Refill', display_alias: 'Mawar Biru', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: patient2Id, email: `pat2-ref-${marker}@test.local`, full_name: 'Pasien Dua Refill', display_alias: 'Melati Indah', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: doctorAId, email: `docA-ref-${marker}@test.local`, full_name: 'Dr. Dokter A Refill', display_alias: 'Dr. A', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: doctorBId, email: `docB-ref-${marker}@test.local`, full_name: 'Dr. Dokter B Refill', display_alias: 'Dr. B', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: companion1Id, email: `comp1-ref-${marker}@test.local`, full_name: 'Pendamping A Refill', display_alias: 'Pendamping A', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
      { id: companion2Id, email: `comp2-ref-${marker}@test.local`, full_name: 'Pendamping B Refill', display_alias: 'Pendamping B', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now }
    ]
  });

  // Doctor Profiles (Verified)
  await prisma.doctor_profiles.createMany({
    data: [
      { user_id: doctorAId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'RSUD Jayapura', str_number: `STR-A-${marker}`, updated_at: now },
      { user_id: doctorBId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'RS Sentani', str_number: `STR-B-${marker}`, updated_at: now }
    ]
  });

  // Companion Profiles (Verified COMPANION)
  await prisma.counselor_profiles.createMany({
    data: [
      { user_id: companion1Id, professional_name: 'Pendamping Sah', profession: 'Pendamping Komunitas', service_role: 'COMPANION', verification_status: 'VERIFIED', permission_enabled: true, is_active: true, verified_at: now, updated_at: now },
      { user_id: companion2Id, professional_name: 'Pendamping Asing', profession: 'Pendamping Komunitas', service_role: 'COMPANION', verification_status: 'VERIFIED', permission_enabled: true, is_active: true, verified_at: now, updated_at: now }
    ]
  });

  // Active Longitudinal Assignment: Companion 1 is assigned to Patient 1
  await prisma.patient_companion_assignments.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      companion_user_id: companion1Id,
      facility_id: facility.id,
      assigned_by_user_id: adminId,
      status: 'ACTIVE',
      started_at: now
    }
  });

  // Clinical Relationship: Doctor A has consultation with Patient 1
  await prisma.consultations.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      assignedDoctorId: doctorAId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Konsultasi ART awal',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  // Active HIV Care Enrollment for Patient 1
  const enrollment1 = await prisma.hiv_care_enrollments.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      facility_id: facility.id,
      status: 'ACTIVE',
      enrolled_at: now,
      created_by_user_id: adminId
    }
  });

  // Active ART Care Plan for Patient 1 prescribed by Doctor A
  const plan1 = await prisma.art_care_plans.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      enrollment_id: enrollment1.id,
      prescribed_by_doctor_id: doctorAId,
      status: 'ACTIVE',
      started_at: now,
      clinical_notes: 'Rejimen lini pertama',
      created_at: now,
      updated_at: now
    }
  });

  const planItem1 = await prisma.art_care_plan_items.create({
    data: {
      id: randomUUID(),
      plan_id: plan1.id,
      medication_name: 'TLD (Tenofovir/Lamivudine/Dolutegravir)',
      dose_instructions: '1 kali sehari sebelum tidur',
      frequency_per_day: 1,
      is_active: true,
      created_at: now,
      updated_at: now
    }
  });

  // Helpers to login and get token with rotating IP
  let ipCounter = 1;
  async function login(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      remoteAddress: `127.0.4.${ipCounter++}`,
      payload: { email, password: 'Secure-test-2026!' }
    });
    assert.equal(res.statusCode, 200);
    return res.json().access_token as string;
  }

  const patient1Token = await login(`pat1-ref-${marker}@test.local`);
  const patient2Token = await login(`pat2-ref-${marker}@test.local`);
  const doctorAToken = await login(`docA-ref-${marker}@test.local`);
  const doctorBToken = await login(`docB-ref-${marker}@test.local`);
  const companion1Token = await login(`comp1-ref-${marker}@test.local`);
  const companion2Token = await login(`comp2-ref-${marker}@test.local`);
  const adminToken = await login(`admin-ref-${marker}@test.local`);

  // =========================================================================
  // 1. PATIENT SIDE-EFFECT NOTES
  // =========================================================================

  // Patient 1 creates a MILD side effect
  const createSe1Res = await app.inject({
    method: 'POST',
    url: '/patient/art-care/side-effects',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      symptom_name: 'Mual ringan setelah minum obat',
      severity: 'MILD',
      patient_note: 'Mulai terasa sekitar 30 menit setelah minum obat malam',
      art_care_plan_id: plan1.id
    }
  });
  assert.equal(createSe1Res.statusCode, 201);
  const se1 = createSe1Res.json();
  assert.equal(se1.symptom_name, 'Mual ringan setelah minum obat');
  assert.equal(se1.severity, 'MILD');
  assert.equal(se1.status, 'ACTIVE');
  assert.ok(se1.public_id.startsWith('se_'));
  assert.ok(se1.disclaimer);
  assert.equal(se1.safety_guidance, null);

  // Patient 1 creates a SEVERE side effect
  const createSe2Res = await app.inject({
    method: 'POST',
    url: '/patient/art-care/side-effects',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      symptom_name: 'Ruam merah menyebar disertai pusing berat',
      severity: 'SEVERE',
      patient_note: 'Tampak di area lengan dan leher'
    }
  });
  assert.equal(createSe2Res.statusCode, 201);
  const se2 = createSe2Res.json();
  assert.equal(se2.severity, 'SEVERE');
  assert.ok(se2.safety_guidance.includes('Keluhan berat atau memburuk'));

  // Patient 1 lists side effects
  const listSeRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care/side-effects',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(listSeRes.statusCode, 200);
  assert.ok(listSeRes.headers['cache-control']?.includes('no-store'));
  const listSe = listSeRes.json();
  assert.equal(listSe.items.length, 2);

  // Patient 1 marks se1 as RESOLVED
  const resolveSe1Res = await app.inject({
    method: 'PATCH',
    url: `/patient/art-care/side-effects/${se1.public_id}`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { status: 'RESOLVED' }
  });
  assert.equal(resolveSe1Res.statusCode, 200);
  const resolvedSe1 = resolveSe1Res.json();
  assert.equal(resolvedSe1.status, 'RESOLVED');
  assert.ok(resolvedSe1.resolved_at);

  // Anti-IDOR: Patient 2 attempts to modify Patient 1's side effect -> 404
  const idorRes = await app.inject({
    method: 'PATCH',
    url: `/patient/art-care/side-effects/${se1.public_id}`,
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { status: 'ACTIVE' }
  });
  assert.equal(idorRes.statusCode, 404);

  // =========================================================================
  // 2. DOCTOR SIDE-EFFECTS ACCESS (SCOPED READ-ONLY)
  // =========================================================================

  // Doctor A has clinical relationship with Patient 1 -> allowed
  const docViewSeRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/side-effects`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docViewSeRes.statusCode, 200);
  assert.equal(docViewSeRes.json().items.length, 2);

  // Doctor B does NOT have clinical relationship with Patient 1 -> 403
  const docBViewSeRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/side-effects`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBViewSeRes.statusCode, 403);

  // Companion attempts to access side-effects directly -> 403 (patientOnly or requireDoctor)
  const companionSideEffectRes = await app.inject({
    method: 'GET',
    url: `/patient/art-care/side-effects`,
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(companionSideEffectRes.statusCode, 403);

  // =========================================================================
  // 3. PERSONAL MEDICATION STOCK & REFILL ALERT
  // =========================================================================

  // Validation: negative stock rejected
  const negStockRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { quantity_remaining: -5, estimated_days_remaining: 10 }
  });
  assert.equal(negStockRes.statusCode, 400);

  // Validation: negative days rejected
  const negDaysRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { quantity_remaining: 20, estimated_days_remaining: -2 }
  });
  assert.equal(negDaysRes.statusCode, 400);

  // Patient 1 records stock: 30 tablets, 30 days remaining
  const stock1Res = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      art_plan_item_id: planItem1.id,
      quantity_remaining: 30,
      unit: 'tablet',
      estimated_days_remaining: 30,
      notes: 'Baru ambil dari apotek'
    }
  });
  assert.equal(stock1Res.statusCode, 201);
  const stock1 = stock1Res.json();
  assert.ok(stock1.public_id.startsWith('stk_'));
  assert.equal(stock1.quantity_remaining, 30);
  assert.equal(stock1.estimated_days_remaining, 30);

  // Check Patient 1 stock endpoint -> Status OK (threshold default 7, remaining 30)
  const getStock1Res = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(getStock1Res.statusCode, 200);
  assert.equal(getStock1Res.json().refill_status.refill_status, 'OK');

  // Patient 1 updates refill threshold setting to 14 days
  const patchSettingRes = await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/refill-settings',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { refill_alert_threshold_days: 14 }
  });
  assert.equal(patchSettingRes.statusCode, 200);
  assert.equal(patchSettingRes.json().refill_alert_threshold_days, 14);

  // Threshold validation: 0 is rejected (min 1), 35 rejected (max 30)
  const badThresholdRes1 = await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/refill-settings',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { refill_alert_threshold_days: 0 }
  });
  assert.equal(badThresholdRes1.statusCode, 400);

  const badThresholdRes2 = await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/refill-settings',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { refill_alert_threshold_days: 35 }
  });
  assert.equal(badThresholdRes2.statusCode, 400);

  // Patient 1 records low stock: 5 days remaining (<= 14 days threshold) -> DUE_SOON
  const stock2Res = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      quantity_remaining: 5,
      unit: 'tablet',
      estimated_days_remaining: 5
    }
  });
  assert.equal(stock2Res.statusCode, 201);

  const getStock2Res = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(getStock2Res.json().refill_status.refill_status, 'DUE_SOON');

  // Patient 1 records zero stock: 0 days remaining -> NEEDS_ATTENTION
  const stock3Res = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      quantity_remaining: 0,
      estimated_days_remaining: 0
    }
  });
  assert.equal(stock3Res.statusCode, 201);

  const getStock3Res = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(getStock3Res.json().refill_status.refill_status, 'NEEDS_ATTENTION');

  // =========================================================================
  // 4. DOCTOR STOCK SUMMARY (SCOPED READ-ONLY)
  // =========================================================================

  // Doctor A can view Patient 1's stock summary
  const docStockRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/stock-summary`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docStockRes.statusCode, 200);
  assert.equal(docStockRes.json().refill_status.refill_status, 'NEEDS_ATTENTION');
  assert.equal(docStockRes.json().history.length, 3);

  // Doctor B (unrelated) is rejected -> 403
  const docBStockRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/stock-summary`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBStockRes.statusCode, 403);

  // =========================================================================
  // 5. REFILL SUPPORT CONSENT FOR COMPANION
  // =========================================================================

  // Default consent is OFF
  const getConsent1 = await app.inject({
    method: 'GET',
    url: '/patient/art-care/refill-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(getConsent1.statusCode, 200);
  assert.equal(getConsent1.json().is_consent_enabled, false);

  // Companion 1 queries refill support while consent is OFF -> returns support_consent_enabled: false
  const compRefillOff = await app.inject({
    method: 'GET',
    url: `/companion/patients/${patient1Id}/refill-support`,
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compRefillOff.statusCode, 200);
  assert.equal(compRefillOff.json().support_consent_enabled, false);
  assert.equal(compRefillOff.json().summary, null);

  // Patient 1 grants refill support consent -> true
  const grantConsentRes = await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/refill-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(grantConsentRes.statusCode, 200);
  assert.equal(grantConsentRes.json().is_consent_enabled, true);
  assert.ok(grantConsentRes.json().consented_at);

  // Companion 1 queries refill support now that consent is ON
  const compRefillOn = await app.inject({
    method: 'GET',
    url: `/companion/patients/${patient1Id}/refill-support`,
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compRefillOn.statusCode, 200);
  assert.ok(compRefillOn.headers['cache-control']?.includes('no-store'));
  const compBody = compRefillOn.json();
  assert.equal(compBody.support_consent_enabled, true);
  assert.ok(compBody.summary);
  assert.equal(compBody.summary.refill_status, 'NEEDS_ATTENTION');
  assert.equal(compBody.summary.coarse_days_bucket, 'NEEDS_ATTENTION');

  // PRIVACY VERIFICATION:
  // Strictly verify NO medication name, dosage, exact quantity, side-effect text
  const rawBodyText = compRefillOn.body;
  assert.ok(!rawBodyText.includes('TLD'));
  assert.ok(!rawBodyText.includes('Tenofovir'));
  assert.ok(!rawBodyText.includes('Lamivudine'));
  assert.ok(!rawBodyText.includes('Dolutegravir'));
  assert.ok(!rawBodyText.includes('Mual'));
  assert.ok(!rawBodyText.includes('Ruam'));
  assert.ok(!rawBodyText.includes('quantity_remaining'));

  // Patient 1 immediately REVOKES refill support consent
  const revokeConsentRes = await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/refill-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: false }
  });
  assert.equal(revokeConsentRes.statusCode, 200);
  assert.equal(revokeConsentRes.json().is_consent_enabled, false);

  // Companion 1 queries immediately after revocation -> denied summary
  const compRefillRevoked = await app.inject({
    method: 'GET',
    url: `/companion/patients/${patient1Id}/refill-support`,
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compRefillRevoked.statusCode, 200);
  assert.equal(compRefillRevoked.json().support_consent_enabled, false);
  assert.equal(compRefillRevoked.json().summary, null);

  // Companion 2 has NO assignment with Patient 1 -> 403
  const comp2RefillRes = await app.inject({
    method: 'GET',
    url: `/companion/patients/${patient1Id}/refill-support`,
    headers: { authorization: `Bearer ${companion2Token}` }
  });
  assert.equal(comp2RefillRes.statusCode, 403);

  // Admin has NO clinical endpoint bypass
  const adminDocRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/side-effects`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminDocRes.statusCode, 403);

  // =========================================================================
  // 6. SAFE AUDIT LOGGING VERIFICATION
  // =========================================================================
  const auditLogs = await prisma.audit_logs.findMany({
    where: {
      action: {
        in: [
          'ART_SIDE_EFFECT_CREATED',
          'ART_SIDE_EFFECT_RESOLVED',
          'ART_STOCK_RECORDED',
          'ART_REFILL_SETTING_UPDATED',
          'ART_REFILL_SUPPORT_CONSENT_GRANTED',
          'ART_REFILL_SUPPORT_CONSENT_REVOKED',
          'ART_REFILL_SUPPORT_VIEWED'
        ]
      }
    }
  });

  assert.ok(auditLogs.length >= 7, 'Semua event audit AG-06 harus terekam');
  for (const log of auditLogs) {
    const metaStr = JSON.stringify(log.meta || {});
    assert.ok(!metaStr.includes('Mual'), 'Symptom free-text tidak boleh ada dalam audit log');
    assert.ok(!metaStr.includes('Ruam'), 'Symptom free-text tidak boleh ada dalam audit log');
    assert.ok(!metaStr.includes('TLD'), 'Nama obat tidak boleh ada dalam audit log');
    assert.ok(!metaStr.includes('Tenofovir'), 'Nama obat tidak boleh ada dalam audit log');
  }

  // =========================================================================
  // 7. AG-06A AUDIT: DOCTOR CLINICAL SCOPE ISOLATION FROM COMPANION ASSIGNMENTS
  // =========================================================================

  // A. Patient 1 has active companion assignment with Companion 1, but Doctor B has no clinical relationship -> Doctor B DENIED (403)
  const docBSePre = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/side-effects`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBSePre.statusCode, 403, 'Doctor B without clinical scope must be 403 even if companion is active');

  const docBStockPre = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/stock-summary`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBStockPre.statusCode, 403, 'Doctor B without clinical scope must be 403 on stock summary');

  // B. Doctor A has valid clinical relationship (consultation) with Patient 1 -> Doctor A ALLOWED (200)
  const docASePre = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/side-effects`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docASePre.statusCode, 200, 'Doctor A with valid clinical relationship must be 200');

  const docAStockPre = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/stock-summary`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docAStockPre.statusCode, 200, 'Doctor A with valid clinical relationship must be 200');

  // C. Companion Reassignment: Reassign companion from Companion 1 to Companion 2
  await prisma.patient_companion_assignments.updateMany({
    where: { patient_user_id: patient1Id, companion_user_id: companion1Id },
    data: { status: 'ENDED', ended_at: new Date() }
  });
  await prisma.patient_companion_assignments.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      companion_user_id: companion2Id,
      facility_id: facility.id,
      assigned_by_user_id: adminId,
      status: 'ACTIVE',
      started_at: new Date()
    }
  });

  // Reassignment must NOT give Doctor B clinical access (Doctor B still 403)
  const docBSePost = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/side-effects`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBSePost.statusCode, 403, 'Companion reassignment must never grant doctor clinical access');

  const docBStockPost = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/stock-summary`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBStockPost.statusCode, 403, 'Companion reassignment must never grant doctor stock access');

  // Reassignment must NOT revoke Doctor A's independent clinical access (Doctor A still 200)
  const docASePost = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/art-care/side-effects`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docASePost.statusCode, 200, 'Doctor A independent clinical scope must persist across companion reassignment');

  // =========================================================================
  // 8. AG-06A AUDIT: REFILL STATUS SEMANTICS MATRIX
  // =========================================================================

  // Scenario 1: Patient 2 has NO stock snapshots -> UNKNOWN
  const p2EmptyStockRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(p2EmptyStockRes.statusCode, 200);
  assert.equal(p2EmptyStockRes.json().refill_status.refill_status, 'UNKNOWN', 'Empty stock must be UNKNOWN, not NEEDS_ATTENTION');
  assert.equal(p2EmptyStockRes.json().current_stock, null);

  // Scenario 2: Patient 2 records exact quantity ONLY without usable days estimate -> UNKNOWN (zero regimen inference)
  const p2QtyOnlyPost = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { quantity_remaining: 60, unit: 'tablet' }
  });
  assert.equal(p2QtyOnlyPost.statusCode, 201);

  const p2QtyOnlyGet = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(p2QtyOnlyGet.json().refill_status.refill_status, 'UNKNOWN', 'Quantity without days estimate must be UNKNOWN');
  assert.equal(p2QtyOnlyGet.json().refill_status.estimated_days_remaining, null);
  assert.equal(p2QtyOnlyGet.json().current_stock.quantity_remaining, 60);

  // Scenario 3: 8 days remaining, threshold 7 -> OK
  await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { estimated_days_remaining: 8 }
  });
  const p2EightDaysGet = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(p2EightDaysGet.json().refill_status.refill_status, 'OK', '8 days > threshold 7 must be OK');

  // Scenario 4: 7 days remaining, threshold 7 -> DUE_SOON (<= threshold)
  await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { estimated_days_remaining: 7 }
  });
  const p2SevenDaysGet = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(p2SevenDaysGet.json().refill_status.refill_status, 'DUE_SOON', '7 days <= threshold 7 must be DUE_SOON');

  // Scenario 5: 3 days remaining, threshold 7 -> DUE_SOON (<= threshold and > 0)
  await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { estimated_days_remaining: 3 }
  });
  const p2ThreeDaysGet = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(p2ThreeDaysGet.json().refill_status.refill_status, 'DUE_SOON', '3 days must be DUE_SOON');

  // Scenario 6: 0 days remaining -> NEEDS_ATTENTION
  await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { estimated_days_remaining: 0 }
  });
  const p2ZeroDaysGet = await app.inject({
    method: 'GET',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(p2ZeroDaysGet.json().refill_status.refill_status, 'NEEDS_ATTENTION', '0 days must be NEEDS_ATTENTION');

  await app.close();
});
