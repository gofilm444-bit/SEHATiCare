import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-08A: Referral Lifecycle, Consent Race & Escalation Dedupe Audit', async () => {
  const app = await buildApp();
  const marker = randomUUID().slice(0, 8);

  const adminId = randomUUID();
  const patient1Id = randomUUID();
  const patient2Id = randomUUID();
  const sourceDocId = randomUUID();
  const facilityDocId = randomUUID(); // Shares facility with patient, but NO clinical consultation
  const targetDoc1Id = randomUUID();
  const targetDoc2Id = randomUUID();
  const unrelatedDocId = randomUUID();
  const inactiveDocId = randomUUID();
  const companion1Id = randomUUID();
  const companion2Id = randomUUID();

  const passwordHash = await bcrypt.hash('Secure-test-2026!', 12);
  const now = new Date();

  // 1. Create Regions
  const regionA = await prisma.regions.create({
    data: {
      id: randomUUID(),
      name: `Kota Jayapura Audit ${marker}`,
      code: `JPA-${marker}`,
      type: 'CITY_REGENCY',
      updated_at: now
    }
  });

  // 2. Create Facilities
  const facilitySource = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Puskesmas Jayapura Audit Sumber ${marker}`,
      facility_type: 'PUSKESMAS',
      region_id: regionA.id,
      address: 'Jl. Ahmad Yani No. 10',
      public_contact: '08123456701',
      service_hours: '08:00 - 16:00 WIT',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  const facilityTarget = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `RSUD Abepura Audit Target ${marker}`,
      facility_type: 'RUMAH_SAKIT',
      region_id: regionA.id,
      address: 'Jl. Kesehatan No. 5 Abepura',
      public_contact: '08123456702',
      service_hours: '24 Jam',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  const facilityInactive = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Klinik Non-Aktif ${marker}`,
      facility_type: 'KLINIK',
      region_id: regionA.id,
      address: 'Jl. Nonaktif No. 99',
      public_contact: '08123456799',
      service_hours: 'Tutup',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: false,
      updated_at: now
    }
  });

  // 3. Facility Services
  await prisma.facility_services.createMany({
    data: [
      {
        facility_id: facilitySource.id,
        service: 'CLINICAL_CONSULTATION',
        verified: true,
        is_active: true,
        appointment_required: false,
        notes_public: 'Poli umum'
      },
      {
        facility_id: facilitySource.id,
        service: 'LAB_MONITORING',
        verified: true,
        is_active: false, // Inactive LAB_MONITORING at source
        appointment_required: false,
        notes_public: 'Laboratorium sedang pemeliharaan'
      },
      {
        facility_id: facilityTarget.id,
        service: 'ART_CONTINUITY',
        verified: true,
        is_active: true,
        appointment_required: true,
        notes_public: 'Layanan ARV'
      },
      {
        facility_id: facilityTarget.id,
        service: 'REFERRAL_INTAKE',
        verified: true,
        is_active: true,
        appointment_required: true,
        notes_public: 'Layanan rujukan'
      },
      {
        facility_id: facilityInactive.id,
        service: 'ART_CONTINUITY',
        verified: true,
        is_active: true,
        appointment_required: false,
        notes_public: 'Layanan fasilitas non-aktif'
      }
    ]
  });

  // 4. Create Users
  await prisma.users.createMany({
    data: [
      { id: adminId, email: `admin-audit-${marker}@test.local`, full_name: 'Admin Audit', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
      { id: patient1Id, email: `pat1-audit-${marker}@test.local`, full_name: 'Pasien Audit 1', display_alias: 'Audit Mawar', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: patient2Id, email: `pat2-audit-${marker}@test.local`, full_name: 'Pasien Audit 2', display_alias: 'Audit Melati', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: sourceDocId, email: `srcdoc-audit-${marker}@test.local`, full_name: 'Dr. Sumber Audit', display_alias: 'Dr. Sumber', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: facilityDocId, email: `facdoc-audit-${marker}@test.local`, full_name: 'Dr. Se-Fasilitas', display_alias: 'Dr. Sekantor', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: targetDoc1Id, email: `tgtdoc1-audit-${marker}@test.local`, full_name: 'Dr. Target Audit 1', display_alias: 'Dr. Target Satu', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: targetDoc2Id, email: `tgtdoc2-audit-${marker}@test.local`, full_name: 'Dr. Target Audit 2', display_alias: 'Dr. Target Dua', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: unrelatedDocId, email: `unreldoc-audit-${marker}@test.local`, full_name: 'Dr. Luar Audit', display_alias: 'Dr. Luar', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: inactiveDocId, email: `inactivedoc-audit-${marker}@test.local`, full_name: 'Dr. Inaktif', display_alias: 'Dr. Nonaktif', role: 'DOKTER', password_hash: passwordHash, is_active: false, updated_at: now },
      { id: companion1Id, email: `comp1-audit-${marker}@test.local`, full_name: 'Pendamping Audit 1', display_alias: 'Pendamping Satu', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
      { id: companion2Id, email: `comp2-audit-${marker}@test.local`, full_name: 'Pendamping Audit 2', display_alias: 'Pendamping Dua', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now }
    ]
  });

  // Doctor profiles
  await prisma.doctor_profiles.createMany({
    data: [
      { user_id: sourceDocId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilitySource.name, str_number: `STR-SRC-${marker}`, updated_at: now },
      { user_id: facilityDocId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilitySource.name, str_number: `STR-FAC-${marker}`, updated_at: now },
      { user_id: targetDoc1Id, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilityTarget.name, str_number: `STR-TGT1-${marker}`, updated_at: now },
      { user_id: targetDoc2Id, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilityTarget.name, str_number: `STR-TGT2-${marker}`, updated_at: now },
      { user_id: unrelatedDocId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'Puskesmas Luar', str_number: `STR-UNR-${marker}`, updated_at: now },
      { user_id: inactiveDocId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilityTarget.name, str_number: `STR-INA-${marker}`, updated_at: now }
    ]
  });

  // Companion profiles
  await prisma.counselor_profiles.createMany({
    data: [
      {
        user_id: companion1Id,
        facility_id: facilitySource.id,
        professional_name: 'Pendamping Audit 1',
        profession: 'Pendamping Komunitas',
        service_role: 'COMPANION',
        verification_status: 'VERIFIED',
        permission_enabled: true,
        verified_at: now,
        is_active: true,
        updated_at: now
      },
      {
        user_id: companion2Id,
        facility_id: facilitySource.id,
        professional_name: 'Pendamping Audit 2',
        profession: 'Pendamping Komunitas',
        service_role: 'COMPANION',
        verification_status: 'VERIFIED',
        permission_enabled: true,
        verified_at: now,
        is_active: true,
        updated_at: now
      }
    ]
  });

  // Doctor Affiliations
  const targetDoc2AffiliationId = randomUUID();
  await prisma.doctor_facility_affiliations.createMany({
    data: [
      { id: randomUUID(), doctor_user_id: sourceDocId, facility_id: facilitySource.id, is_active: true },
      { id: randomUUID(), doctor_user_id: facilityDocId, facility_id: facilitySource.id, is_active: true },
      { id: randomUUID(), doctor_user_id: targetDoc1Id, facility_id: facilityTarget.id, is_active: true },
      { id: targetDoc2AffiliationId, doctor_user_id: targetDoc2Id, facility_id: facilityTarget.id, is_active: true },
      { id: randomUUID(), doctor_user_id: inactiveDocId, facility_id: facilityTarget.id, is_active: true }
    ]
  });

  // Longitudinal companion assignment: Companion 1 assigned to Patient 1
  await prisma.patient_companion_assignments.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      companion_user_id: companion1Id,
      facility_id: facilitySource.id,
      assigned_by_user_id: adminId,
      status: 'ACTIVE',
      started_at: now
    }
  });

  // Source doctor has active clinical consultation relationship with Patient 1
  await prisma.consultations.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      assignedDoctorId: sourceDocId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Konsultasi monitoring awal',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  // Login helper
  let ipCounter = 20;
  async function login(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      remoteAddress: `127.0.9.${ipCounter++}`,
      payload: { email, password: 'Secure-test-2026!' }
    });
    assert.equal(res.statusCode, 200);
    return res.json().access_token as string;
  }

  const adminToken = await login(`admin-audit-${marker}@test.local`);
  const patient1Token = await login(`pat1-audit-${marker}@test.local`);
  const patient2Token = await login(`pat2-audit-${marker}@test.local`);
  const sourceDocToken = await login(`srcdoc-audit-${marker}@test.local`);
  const facilityDocToken = await login(`facdoc-audit-${marker}@test.local`);
  const targetDoc1Token = await login(`tgtdoc1-audit-${marker}@test.local`);
  const targetDoc2Token = await login(`tgtdoc2-audit-${marker}@test.local`);
  const unrelatedDocToken = await login(`unreldoc-audit-${marker}@test.local`);
  const companion1Token = await login(`comp1-audit-${marker}@test.local`);
  const companion2Token = await login(`comp2-audit-${marker}@test.local`);

  // =========================================================================
  // 1. FACILITY & SERVICE DESTINATION VALIDATION (AUDIT SECTION 9)
  // =========================================================================

  // Inactive facility rejected
  const reqInactiveFac = await app.inject({
    method: 'POST',
    url: '/patient/referrals/request',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      target_facility_id: facilityInactive.id,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(reqInactiveFac.statusCode, 400);

  // Inactive service rejected (LAB_MONITORING at facilitySource is is_active: false)
  const reqInactiveService = await app.inject({
    method: 'POST',
    url: '/patient/referrals/request',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      target_facility_id: facilitySource.id,
      referral_type: 'LAB_MONITORING'
    }
  });
  assert.equal(reqInactiveService.statusCode, 400);

  // Unsupported service rejected (facilitySource does not have ART_CONTINUITY or ARV_SERVICE)
  const reqUnsupportedService = await app.inject({
    method: 'POST',
    url: '/patient/referrals/request',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      target_facility_id: facilitySource.id,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(reqUnsupportedService.statusCode, 400);

  // Active facility + active matching service allowed -> creates REQUESTED referral
  const patientReqRes = await app.inject({
    method: 'POST',
    url: '/patient/referrals/request',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      target_facility_id: facilityTarget.id,
      referral_type: 'CONTINUITY_OF_CARE',
      scheduling_preference: 'Pagi hari'
    }
  });
  assert.equal(patientReqRes.statusCode, 201);
  const requestedReferral = patientReqRes.json();
  assert.equal(requestedReferral.status, 'REQUESTED');
  const referralPublicId = requestedReferral.public_id;

  // =========================================================================
  // 2. PATIENT REQUEST -> CLINICAL REVIEW PATH (AUDIT SECTION 2)
  // =========================================================================

  // Unrelated doctor: 403 denied
  const unauthReviewRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/review`,
    headers: { authorization: `Bearer ${unrelatedDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(unauthReviewRes.statusCode, 403);

  // Doctor merely sharing facility with patient (no clinical scope): 403 denied
  const facilityDocReviewRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/review`,
    headers: { authorization: `Bearer ${facilityDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(facilityDocReviewRes.statusCode, 403);

  // Admin cannot perform clinical review: 403 denied
  const adminReviewRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/review`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id
    }
  });
  assert.equal(adminReviewRes.statusCode, 403);

  // Companion cannot perform clinical review: 403 denied
  const compReviewRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/review`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id
    }
  });
  assert.equal(compReviewRes.statusCode, 403);

  // Authorized source doctor (with verified clinical relationship) reviews SAME referral
  const validReviewRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/review`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(validReviewRes.statusCode, 200);
  const reviewedReferral = validReviewRes.json();
  assert.equal(reviewedReferral.status, 'DRAFT');
  assert.equal(reviewedReferral.public_id, referralPublicId, 'SAME referral ID must be preserved');

  // Verify NO duplicate referral was created
  const totalPatientReferrals = await prisma.care_referrals.count({
    where: { patient_id: patient1Id }
  });
  assert.equal(totalPatientReferrals, 1, 'Only exactly 1 referral must exist for patient');

  // History gains structured review/DRAFT event
  const dbReferral = await prisma.care_referrals.findUniqueOrThrow({
    where: { public_id: referralPublicId }
  });
  const events = await prisma.care_referral_events.findMany({
    where: { referral_id: dbReferral.id },
    orderBy: { occurred_at: 'asc' }
  });
  assert.ok(events.some(e => e.event_type === 'REQUESTED'));
  assert.ok(events.some(e => e.event_type === 'DRAFTED'));

  // =========================================================================
  // 3. CONSENT STATE MACHINE & CONCURRENCY (AUDIT SECTIONS 3 & 4)
  // =========================================================================

  // Unauthorized users cannot alter consent
  const docConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(docConsentRes.statusCode, 403);

  const compConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(compConsentRes.statusCode, 403);

  const adminConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(adminConsentRes.statusCode, 403);

  // Grant consent before send -> allowed (becomes CONSENTED)
  const grantConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(grantConsentRes.statusCode, 200);
  assert.equal(grantConsentRes.json().status, 'CONSENTED');

  // Revoke consent before send -> allowed (consent disabled)
  const revokeConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: false }
  });
  assert.equal(revokeConsentRes.statusCode, 200);
  assert.equal(revokeConsentRes.json().is_consent_enabled, false);

  // Doctor attempt to SEND after revocation -> rejected
  const sendAfterRevokeRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(sendAfterRevokeRes.statusCode, 400);

  // Concurrency check: Ensure DB referral is NOT sent
  const currentReferralDb = await prisma.care_referrals.findUnique({
    where: { id: dbReferral.id }
  });
  assert.notEqual(currentReferralDb?.status, 'SENT', 'Referral must not become SENT when consent is revoked');

  // Re-grant consent
  const regrantConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(regrantConsentRes.statusCode, 200);
  assert.equal(regrantConsentRes.json().status, 'CONSENTED');

  // =========================================================================
  // 4. TARGET DOCTOR AFFILIATION AUDIT (AUDIT SECTION 5)
  // =========================================================================

  // Test target doctor affiliation checks when creating or updating draft
  // A. Target doctor is inactive
  const draftInactiveDoc = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${patient1Id}/referrals`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: inactiveDocId,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(draftInactiveDoc.statusCode, 400);

  // B. Target doctor affiliated to different facility (facilitySource instead of facilityTarget)
  const draftWrongFacDoc = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${patient1Id}/referrals`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: facilityDocId,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(draftWrongFacDoc.statusCode, 400);

  // C. Target doctor with inactive affiliation:
  // Create a draft with targetDoc2
  const draftTargetDoc2 = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${patient1Id}/referrals`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc2Id,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  assert.equal(draftTargetDoc2.statusCode, 201);
  const targetDoc2RefId = draftTargetDoc2.json().public_id;

  // Deactivate affiliation of targetDoc2
  await prisma.doctor_facility_affiliations.update({
    where: { id: targetDoc2AffiliationId },
    data: { is_active: false }
  });

  // Patient consents to targetDoc2 referral
  await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${targetDoc2RefId}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });

  // Doctor attempt to SEND to targetDoc2 with revoked affiliation -> rejected!
  const sendRevokedAffilRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${targetDoc2RefId}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(sendRevokedAffilRes.statusCode, 400);

  // Re-activate affiliation for targetDoc2
  await prisma.doctor_facility_affiliations.update({
    where: { id: targetDoc2AffiliationId },
    data: { is_active: true }
  });

  // Now SEND succeeds
  const sendTargetDoc2Ok = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${targetDoc2RefId}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(sendTargetDoc2Ok.statusCode, 200);

  // Now deactivate affiliation of targetDoc2 AFTER SEND but BEFORE ACCEPT
  await prisma.doctor_facility_affiliations.update({
    where: { id: targetDoc2AffiliationId },
    data: { is_active: false }
  });

  // TargetDoc2 attempts to ACCEPT -> rejected because affiliation was deactivated!
  const acceptRevokedAffilRes = await app.inject({
    method: 'POST',
    url: `/doctor/incoming-referrals/${targetDoc2RefId}/accept`,
    headers: { authorization: `Bearer ${targetDoc2Token}` }
  });
  assert.equal(acceptRevokedAffilRes.statusCode, 400);

  // Re-activate targetDoc2 affiliation for clean state
  await prisma.doctor_facility_affiliations.update({
    where: { id: targetDoc2AffiliationId },
    data: { is_active: true }
  });

  // =========================================================================
  // 5. CLINICAL SCOPE BEFORE/AFTER ACCEPT & ACCEPT ATOMICITY (SECTIONS 6 & 7)
  // =========================================================================

  // Check pre-send clinical scope for targetDoc1 on patient 1:
  // In DRAFT / CONSENTED: targetDoc1 has NO clinical chart access
  const preSendChartAccess = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(preSendChartAccess.statusCode, 403, 'Target doctor must have NO clinical chart access before ACCEPT');

  // Now SEND referralPublicId (which targets targetDoc1)
  const sendRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(sendRes.statusCode, 200);
  assert.equal(sendRes.json().status, 'SENT');

  // Mutation after SENT: Patient cannot alter consent
  const mutateAfterSentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: false }
  });
  assert.equal(mutateAfterSentRes.statusCode, 409);

  // In SENT state:
  // A. Target doctor sees incoming referral envelope
  const envelopeRes = await app.inject({
    method: 'GET',
    url: `/doctor/incoming-referrals/${referralPublicId}`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(envelopeRes.statusCode, 200);

  // B. Target doctor STILL has NO clinical chart access
  const sentChartAccess = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(sentChartAccess.statusCode, 403, 'Target doctor must NOT gain full chart access in SENT state');

  // ACCEPT TRANSACTION ATOMICITY
  // Target doctor 1 accepts referral
  const acceptRes = await app.inject({
    method: 'POST',
    url: `/doctor/incoming-referrals/${referralPublicId}/accept`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(acceptRes.statusCode, 200);
  assert.equal(acceptRes.json().status, 'ACCEPTED');

  // Verify atomic creation: Consultation exists for targetDoc1 and patient1
  const targetConsultation = await prisma.consultations.findFirst({
    where: {
      patient_id: patient1Id,
      assignedDoctorId: targetDoc1Id
    }
  });
  assert.ok(targetConsultation, 'Consultation must exist linking patient and accepting doctor');

  // Duplicate ACCEPT attempt on same referral -> rejected (409)
  const dupAcceptRes = await app.inject({
    method: 'POST',
    url: `/doctor/incoming-referrals/${referralPublicId}/accept`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(dupAcceptRes.statusCode, 409, 'Duplicate accept must be rejected');

  // CLINICAL SCOPE AFTER ACCEPT:
  // Target doctor 1 now has clinical chart access
  const postAcceptChartAccess = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(postAcceptChartAccess.statusCode, 200, 'Accepted doctor must gain clinical chart access');

  // Same-facility unrelated doctor (even at target facility) still has NO chart access
  const sameFacUnrelatedChart = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${unrelatedDocToken}` }
  });
  assert.equal(sameFacUnrelatedChart.statusCode, 403, 'Unrelated doctor must NOT gain clinical chart access');

  // Consent mutation after ACCEPTED -> rejected
  const mutateAfterAcceptedRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: false }
  });
  assert.equal(mutateAfterAcceptedRes.statusCode, 409);

  // Complete referral
  const completeRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${referralPublicId}/complete`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(completeRes.statusCode, 200);

  // Terminal state consent mutation on COMPLETED -> rejected
  const mutateTerminalRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${referralPublicId}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(mutateTerminalRes.statusCode, 409);

  // DECLINE workflow and clinical scope:
  // Create another referral for Patient 2, who has no consultation with targetDoc1
  // Source doc consults with patient 2
  await prisma.consultations.create({
    data: {
      id: randomUUID(),
      patient_id: patient2Id,
      assignedDoctorId: sourceDocId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Konsultasi pasien 2',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  const draft2Res = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${patient2Id}/referrals`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id,
      referral_type: 'CONTINUITY_OF_CARE'
    }
  });
  const ref2PublicId = draft2Res.json().public_id;

  await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${ref2PublicId}/consent`,
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { is_consent_enabled: true }
  });

  await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${ref2PublicId}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });

  // Target doctor declines referral
  const declineRes = await app.inject({
    method: 'POST',
    url: `/doctor/incoming-referrals/${ref2PublicId}/decline`,
    headers: { authorization: `Bearer ${targetDoc1Token}` },
    payload: { reason: 'CAPACITY_UNAVAILABLE' }
  });
  assert.equal(declineRes.statusCode, 200);
  assert.equal(declineRes.json().status, 'DECLINED');

  // Declined doctor must NOT gain clinical chart access for Patient 2
  const declinedChartAccess = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient2Id}/monitoring`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(declinedChartAccess.statusCode, 403, 'Declined referral must NOT confer clinical scope');

  // Terminal mutation on DECLINED -> rejected
  const mutateDeclinedConsent = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${ref2PublicId}/consent`,
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(mutateDeclinedConsent.statusCode, 409);

  // =========================================================================
  // 6. CARE SIGNAL ESCALATION DEDUPE (AUDIT SECTION 8)
  // =========================================================================

  // Enable follow-up consent for Patient 1 so care signal can be accessed by companion
  await prisma.care_follow_up_support_consents.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      is_consent_enabled: true,
      consented_at: now
    }
  });

  // Create an active care signal for Patient 1
  const signalId = randomUUID();
  await prisma.care_signals.create({
    data: {
      id: signalId,
      patient_id: patient1Id,
      signal_type: 'FOLLOW_UP_OVERDUE',
      priority: 'ROUTINE',
      signal_scope: 'SUPPORT',
      status: 'OPEN',
      source_type: 'CONTROL_SCHEDULE',
      detected_at: now
    }
  });

  // Companion 1 triggers ESCALATED_TO_CLINICAL
  const escalate1 = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${signalId}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: {
      action_type: 'ESCALATED_TO_CLINICAL'
    }
  });
  assert.equal(escalate1.statusCode, 200);

  // Find the created referral for this care signal
  const escalatedReferralsAfterFirst = await prisma.care_referrals.findMany({
    where: { source_care_signal_id: signalId }
  });
  assert.equal(escalatedReferralsAfterFirst.length, 1);
  const firstEscalatedReferralId = escalatedReferralsAfterFirst[0].id;
  assert.equal(escalatedReferralsAfterFirst[0].status, 'REQUESTED');
  assert.equal(escalatedReferralsAfterFirst[0].initiation_type, 'CARE_SIGNAL_ESCALATION');

  // Companion triggers ESCALATED_TO_CLINICAL AGAIN (duplicate click, network retry)
  const escalateRetry = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${signalId}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: {
      action_type: 'ESCALATED_TO_CLINICAL'
    }
  });
  assert.equal(escalateRetry.statusCode, 200);

  // Confirm NO duplicate referral was created
  const escalatedReferralsAfterRetry = await prisma.care_referrals.findMany({
    where: { source_care_signal_id: signalId }
  });
  assert.equal(escalatedReferralsAfterRetry.length, 1, 'Repeated escalation must not create multiple active referrals');
  assert.equal(escalatedReferralsAfterRetry[0].id, firstEscalatedReferralId);

  // Companion does NOT gain clinical scope
  const compChartAccess = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compChartAccess.statusCode, 403);

  // The escalated referral still requires doctor review and patient consent before SEND
  const escalatedSendAttempt = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${escalatedReferralsAfterRetry[0].public_id}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(escalatedSendAttempt.statusCode, 400, 'Escalated referral must require consent before send');

  // =========================================================================
  // 7. PRIVACY REGRESSION & REFERRAL EVENTS (AUDIT SECTIONS 10, 11, 12)
  // =========================================================================

  // Events verification: no clinical free text / diagnosis / labs in referral events
  const allEvents = await prisma.care_referral_events.findMany({
    where: { referral_id: dbReferral.id }
  });
  for (const ev of allEvents) {
    const jsonStr = JSON.stringify(ev);
    assert.doesNotMatch(jsonStr, /diagnosis/i);
    assert.doesNotMatch(jsonStr, /viral_load/i);
    assert.doesNotMatch(jsonStr, /\bcd4\b/i);
    assert.doesNotMatch(jsonStr, /regimen/i);
  }

  // Admin cannot see patient-level referral content
  const adminPatientView = await app.inject({
    method: 'GET',
    url: `/patient/referrals/${referralPublicId}`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminPatientView.statusCode, 403);

  // Admin can access aggregate governance summary only
  const adminGovRes = await app.inject({
    method: 'GET',
    url: '/admin/governance/referrals/summary',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminGovRes.statusCode, 200);
  const adminSummary = adminGovRes.json();
  assert.ok(typeof adminSummary.total_requested === 'number');
  assert.equal((adminSummary as any).patient_ids, undefined, 'Admin aggregate must not contain patient IDs');

  // Companion cannot alter referral destination
  const compUpdateRes = await app.inject({
    method: 'PATCH',
    url: `/doctor/referrals/${referralPublicId}`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { target_facility_id: facilityTarget.id }
  });
  assert.equal(compUpdateRes.statusCode, 403);
});
