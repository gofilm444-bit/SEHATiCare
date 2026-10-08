import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-08: Confidential Referral, Transfer & Service Navigation Foundation', async () => {
  const app = await buildApp();
  const marker = randomUUID().slice(0, 8);

  const adminId = randomUUID();
  const patient1Id = randomUUID();
  const patient2Id = randomUUID();
  const sourceDocId = randomUUID();
  const targetDoc1Id = randomUUID();
  const targetDoc2Id = randomUUID();
  const unrelatedDocId = randomUUID();
  const companion1Id = randomUUID();
  const companion2Id = randomUUID();

  const passwordHash = await bcrypt.hash('Secure-test-2026!', 12);
  const now = new Date();

  // 1. Create Regions
  const regionA = await prisma.regions.create({
    data: {
      id: randomUUID(),
      name: `Kota Jayapura ${marker}`,
      code: `JPR-${marker}`,
      type: 'CITY_REGENCY',
      updated_at: now
    }
  });

  const regionB = await prisma.regions.create({
    data: {
      id: randomUUID(),
      name: `Kabupaten Keerom ${marker}`,
      code: `KRM-${marker}`,
      type: 'CITY_REGENCY',
      updated_at: now
    }
  });

  // 2. Create Facilities
  const facilitySource = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Puskesmas Jayapura Asri ${marker}`,
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
      name: `RSUD Abepura Rujukan ${marker}`,
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

  const facilityOther = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Klinik Pratama Keerom ${marker}`,
      facility_type: 'KLINIK',
      region_id: regionB.id,
      address: 'Jl. Trans Papua No. 8',
      public_contact: '08123456703',
      service_hours: '08:00 - 14:00 WIT',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  // 3. Setup facility services (including active, inactive, requirements)
  await prisma.facility_services.createMany({
    data: [
      {
        facility_id: facilitySource.id,
        service: 'CLINICAL_CONSULTATION',
        verified: true,
        is_active: true,
        appointment_required: false,
        opening_time: '08:00',
        closing_time: '16:00',
        contact_public: '08123456701',
        notes_public: 'Poli umum dan konsultasi'
      },
      {
        facility_id: facilitySource.id,
        service: 'HIV_TESTING',
        verified: true,
        is_active: true,
        appointment_required: false,
        notes_public: 'Layanan tes sukarela'
      },
      {
        facility_id: facilityTarget.id,
        service: 'ART_CONTINUITY',
        verified: true,
        is_active: true,
        appointment_required: true,
        opening_time: '08:00',
        closing_time: '14:00',
        contact_public: '08123456702',
        notes_public: 'Layanan kontinuitas ARV'
      },
      {
        facility_id: facilityTarget.id,
        service: 'REFERRAL_INTAKE',
        verified: true,
        is_active: true,
        appointment_required: true,
        notes_public: 'Penerimaan rujukan inter-fasilitas'
      },
      {
        facility_id: facilityTarget.id,
        service: 'LAB_MONITORING',
        verified: true,
        is_active: false, // Inactive service to test exclusion
        appointment_required: true,
        notes_public: 'Laboratorium sedang pemeliharaan alat'
      }
    ]
  });

  // 4. Create Users
  await prisma.users.createMany({
    data: [
      { id: adminId, email: `admin-ref-${marker}@test.local`, full_name: 'Admin AG08', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
      { id: patient1Id, email: `pat1-ref-${marker}@test.local`, full_name: 'Pasien Satu Ref', display_alias: 'Mawar Jayapura', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: patient2Id, email: `pat2-ref-${marker}@test.local`, full_name: 'Pasien Dua Ref', display_alias: 'Melati Sentani', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: sourceDocId, email: `srcdoc-ref-${marker}@test.local`, full_name: 'Dr. Dokter Sumber', display_alias: 'Dr. Sumber', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: targetDoc1Id, email: `tgtdoc1-ref-${marker}@test.local`, full_name: 'Dr. Dokter Target 1', display_alias: 'Dr. Target Satu', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: targetDoc2Id, email: `tgtdoc2-ref-${marker}@test.local`, full_name: 'Dr. Dokter Target 2', display_alias: 'Dr. Target Dua', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: unrelatedDocId, email: `unreldoc-ref-${marker}@test.local`, full_name: 'Dr. Dokter Luar', display_alias: 'Dr. Luar', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: companion1Id, email: `comp1-ref-${marker}@test.local`, full_name: 'Pendamping A Ref', display_alias: 'Pendamping A', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
      { id: companion2Id, email: `comp2-ref-${marker}@test.local`, full_name: 'Pendamping B Ref', display_alias: 'Pendamping B', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now }
    ]
  });

  // Doctor profiles
  await prisma.doctor_profiles.createMany({
    data: [
      { user_id: sourceDocId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilitySource.name, str_number: `STR-SRC-${marker}`, updated_at: now },
      { user_id: targetDoc1Id, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilityTarget.name, str_number: `STR-TGT1-${marker}`, updated_at: now },
      { user_id: targetDoc2Id, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: facilityTarget.name, str_number: `STR-TGT2-${marker}`, updated_at: now },
      { user_id: unrelatedDocId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'Puskesmas Unrelated', str_number: `STR-UNR-${marker}`, updated_at: now }
    ]
  });

  // Companion profiles
  await prisma.counselor_profiles.createMany({
    data: [
      {
        user_id: companion1Id,
        facility_id: facilitySource.id,
        professional_name: 'Pendamping A',
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
        professional_name: 'Pendamping B',
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
  await prisma.doctor_facility_affiliations.createMany({
    data: [
      { id: randomUUID(), doctor_user_id: sourceDocId, facility_id: facilitySource.id, is_active: true },
      { id: randomUUID(), doctor_user_id: targetDoc1Id, facility_id: facilityTarget.id, is_active: true },
      { id: randomUUID(), doctor_user_id: targetDoc2Id, facility_id: facilityTarget.id, is_active: true }
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

  // Source doctor has active clinical relationship with Patient 1
  await prisma.consultations.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      assignedDoctorId: sourceDocId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Konsultasi awal sebelum rujukan',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  // Auth tokens
  let ipCounter = 10;
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

  const adminToken = await login(`admin-ref-${marker}@test.local`);
  const patient1Token = await login(`pat1-ref-${marker}@test.local`);
  const patient2Token = await login(`pat2-ref-${marker}@test.local`);
  const sourceDocToken = await login(`srcdoc-ref-${marker}@test.local`);
  const targetDoc1Token = await login(`tgtdoc1-ref-${marker}@test.local`);
  const targetDoc2Token = await login(`tgtdoc2-ref-${marker}@test.local`);
  const unrelatedDocToken = await login(`unreldoc-ref-${marker}@test.local`);
  const companion1Token = await login(`comp1-ref-${marker}@test.local`);
  const companion2Token = await login(`comp2-ref-${marker}@test.local`);

  // =========================================================================
  // SECTION A: SERVICE FACILITY DIRECTORY (PUBLIC & PERMISSION BOUNDARIES)
  // =========================================================================

  // 1. Public list returns verified facilities and active services only
  const publicListRes = await app.inject({
    method: 'GET',
    url: `/public/service-facilities?region_id=${regionA.id}`
  });
  assert.equal(publicListRes.statusCode, 200);
  const publicList = publicListRes.json();
  assert.ok(Array.isArray(publicList.items));
  const foundTarget = publicList.items.find((f: any) => f.id === facilityTarget.id);
  assert.ok(foundTarget, 'Target facility must be returned in public directory');
  assert.equal(foundTarget.name, facilityTarget.name);

  // Inactive service (LAB_MONITORING) must be excluded from public directory
  const labService = foundTarget.services.find((s: any) => s.service === 'LAB_MONITORING');
  assert.equal(labService, undefined, 'Inactive service must be excluded from public list');

  const artService = foundTarget.services.find((s: any) => s.service === 'ART_CONTINUITY');
  assert.ok(artService, 'Active ART_CONTINUITY service must be present');
  assert.equal(artService.appointment_required, true);

  // 2. Filter by service_type works
  const filterRes = await app.inject({
    method: 'GET',
    url: '/public/service-facilities?service_type=REFERRAL_INTAKE'
  });
  assert.equal(filterRes.statusCode, 200);
  const filterData = filterRes.json();
  assert.ok(filterData.items.some((f: any) => f.id === facilityTarget.id));

  // 3. Public single facility detail
  const publicDetailRes = await app.inject({
    method: 'GET',
    url: `/public/service-facilities/${facilityTarget.id}`
  });
  assert.equal(publicDetailRes.statusCode, 200);
  assert.equal(publicDetailRes.json().id, facilityTarget.id);

  // 4. Admin can create doctor affiliation, non-admin is forbidden
  const nonAdminAffilRes = await app.inject({
    method: 'POST',
    url: `/admin/facilities/${facilityTarget.id}/affiliations`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      doctor_user_id: unrelatedDocId,
      facility_id: facilityTarget.id,
      is_active: true
    }
  });
  assert.equal(nonAdminAffilRes.statusCode, 403, 'Patient cannot manage affiliations');

  const adminAffilRes = await app.inject({
    method: 'POST',
    url: `/admin/facilities/${facilityOther.id}/affiliations`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      doctor_user_id: unrelatedDocId,
      facility_id: facilityOther.id,
      is_active: true
    }
  });
  assert.equal(adminAffilRes.statusCode, 201, 'Admin can manage affiliations');

  // =========================================================================
  // SECTION B: PATIENT-INITIATED REFERRAL REQUEST
  // =========================================================================

  // 1. Patient requests referral based on comfort/preference
  const patReqRes = await app.inject({
    method: 'POST',
    url: '/patient/referrals/request',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      target_facility_id: facilityTarget.id,
      referral_type: 'CONTINUITY_OF_CARE',
      scheduling_preference: 'Pagi hari jam 09:00'
    }
  });
  assert.equal(patReqRes.statusCode, 201);
  const patReferral = patReqRes.json();
  assert.ok(patReferral.public_id);
  assert.equal(patReferral.status, 'REQUESTED');
  assert.equal(patReferral.is_consent_enabled, false, 'Patient consent must be default OFF');
  assert.equal(patReferral.companion_share.is_enabled, false, 'Companion share must be default OFF');

  // Strict validator rejects unknown / clinical free-text fields
  const rejectFreeTextRes = await app.inject({
    method: 'POST',
    url: '/patient/referrals/request',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      target_facility_id: facilityTarget.id,
      referral_type: 'CONTINUITY_OF_CARE',
      clinical_note: 'ODHIV stadium 3', // Unknown field!
      symptoms: 'Demam tinggi'
    }
  });
  assert.equal(rejectFreeTextRes.statusCode, 400, 'Strict validator must reject arbitrary clinical fields');

  // 2. Patient can list own referrals, cannot see other patient's referrals
  const patListRes = await app.inject({
    method: 'GET',
    url: '/patient/referrals',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(patListRes.statusCode, 200);
  assert.ok(patListRes.headers['cache-control']?.includes('no-store'), 'Private endpoint must have no-store');
  assert.equal(patListRes.json().items.length, 1);

  const pat2DetailRes = await app.inject({
    method: 'GET',
    url: `/patient/referrals/${patReferral.public_id}`,
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(pat2DetailRes.statusCode, 404, 'Patient 2 cannot access Patient 1 referral');

  // =========================================================================
  // SECTION C: PATIENT CONSENT LIFECYCLE & REVOCATION GATE
  // =========================================================================

  // Patient grants consent
  const grantConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${patReferral.public_id}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(grantConsentRes.statusCode, 200);
  assert.equal(grantConsentRes.json().is_consent_enabled, true);

  // Patient revokes consent
  const revokeConsentRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${patReferral.public_id}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: false }
  });
  assert.equal(revokeConsentRes.statusCode, 200);
  assert.equal(revokeConsentRes.json().is_consent_enabled, false);

  // =========================================================================
  // SECTION D: DOCTOR-INITIATED WORKFLOW & SCOPE
  // =========================================================================

  // 1. Scoped source doctor can list patient referrals
  const docListPatRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/referrals`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(docListPatRes.statusCode, 200);

  // Unrelated doctor has NO scope with Patient 1 -> 403
  const unrelListPatRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/referrals`,
    headers: { authorization: `Bearer ${unrelatedDocToken}` }
  });
  assert.equal(unrelListPatRes.statusCode, 403, 'Unrelated doctor must be denied patient referral access');

  // 2. Doctor queries eligible target clinicians at target facility
  const destCliniciansRes = await app.inject({
    method: 'GET',
    url: `/doctor/referral-destinations/${facilityTarget.id}/clinicians`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(destCliniciansRes.statusCode, 200);
  const clinicians = destCliniciansRes.json().items;
  assert.ok(clinicians.some((c: any) => c.id === targetDoc1Id));
  assert.ok(clinicians.some((c: any) => c.id === targetDoc2Id));

  // 3. Source doctor creates draft referral for Patient 1
  const docDraftRes = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${patient1Id}/referrals`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id,
      referral_type: 'CONTINUITY_OF_CARE',
      scheduling_preference: 'Rabu pagi'
    }
  });
  assert.equal(docDraftRes.statusCode, 201);
  const docReferral = docDraftRes.json();
  assert.equal(docReferral.status, 'DRAFT');
  assert.equal(docReferral.is_consent_enabled, false);

  // 4. Source doctor CANNOT send without consent
  const prematureSendRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${docReferral.public_id}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(prematureSendRes.statusCode, 400, 'Sending without patient consent must fail');

  // 5. Source doctor requests consent -> status becomes PENDING_PATIENT_CONSENT
  const reqConsentRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${docReferral.public_id}/request-consent`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(reqConsentRes.statusCode, 200);
  assert.equal(reqConsentRes.json().status, 'PENDING_PATIENT_CONSENT');

  // 6. Patient grants consent -> status becomes CONSENTED
  const patGrantRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${docReferral.public_id}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(patGrantRes.statusCode, 200);
  assert.equal(patGrantRes.json().status, 'CONSENTED');

  // 7. Source doctor sends referral -> status becomes SENT
  const sendRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${docReferral.public_id}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(sendRes.statusCode, 200);
  assert.equal(sendRes.json().status, 'SENT');

  // =========================================================================
  // SECTION E: RECEIVING DOCTOR INBOX, PRIVACY ENVELOPE & ACCEPTANCE
  // =========================================================================

  // 1. Only named receiving doctor (targetDoc1) sees incoming referral
  const target1InboxRes = await app.inject({
    method: 'GET',
    url: '/doctor/incoming-referrals',
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(target1InboxRes.statusCode, 200);
  const target1Inbox = target1InboxRes.json().items;
  assert.ok(target1Inbox.some((r: any) => r.public_id === docReferral.public_id));

  // 2. PRIVACY BOUNDARY: Doctor 2 at the SAME facility CANNOT see it!
  const target2InboxRes = await app.inject({
    method: 'GET',
    url: '/doctor/incoming-referrals',
    headers: { authorization: `Bearer ${targetDoc2Token}` }
  });
  assert.equal(target2InboxRes.statusCode, 200);
  const target2Inbox = target2InboxRes.json().items;
  assert.ok(!target2Inbox.some((r: any) => r.public_id === docReferral.public_id), 'Same facility doctor must NOT see incoming referral');

  const target2DetailRes = await app.inject({
    method: 'GET',
    url: `/doctor/incoming-referrals/${docReferral.public_id}`,
    headers: { authorization: `Bearer ${targetDoc2Token}` }
  });
  assert.equal(target2DetailRes.statusCode, 403, 'Doctor 2 at same facility must be forbidden');

  // 3. MINIMAL PRE-ACCEPTANCE ENVELOPE: target doctor sees alias, facility, type ONLY.
  // NO ART regimen, NO medications, NO VL/CD4, NO notes!
  const envelopeRes = await app.inject({
    method: 'GET',
    url: `/doctor/incoming-referrals/${docReferral.public_id}`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(envelopeRes.statusCode, 200);
  const envelope = envelopeRes.json();
  assert.equal(envelope.patient_display_alias, 'Mawar Jayapura');
  assert.equal(envelope.target_facility_name, facilityTarget.name);
  assert.equal(envelope.referral_type, 'CONTINUITY_OF_CARE');
  assert.equal((envelope as any).art_regimen, undefined);
  assert.equal((envelope as any).viral_load, undefined);
  assert.equal((envelope as any).clinical_notes, undefined);

  // 4. Before ACCEPT, target doctor does NOT have general clinical scope for Patient 1
  const preAcceptCareRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(preAcceptCareRes.statusCode, 403, 'Target doctor must have NO clinical scope before accepting');

  // 5. Target doctor ACCEPTS incoming referral
  const acceptRes = await app.inject({
    method: 'POST',
    url: `/doctor/incoming-referrals/${docReferral.public_id}/accept`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(acceptRes.statusCode, 200);
  assert.equal(acceptRes.json().status, 'ACCEPTED');

  // 6. After ACCEPT, target doctor HAS legitimate clinical relationship!
  const postAcceptCareRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  // Should succeed (200) because acceptance created an active consultation!
  assert.equal(postAcceptCareRes.statusCode, 200, 'Target doctor gains legitimate clinical relationship after acceptance');

  // 7. Source doctor STILL maintains valid relationship (no destructive removal)
  const sourceDocCareRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/monitoring`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });
  assert.equal(sourceDocCareRes.statusCode, 200, 'Source doctor relationship remains intact');

  // 8. Doctor completes referral
  const completeRes = await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${docReferral.public_id}/complete`,
    headers: { authorization: `Bearer ${targetDoc1Token}` }
  });
  assert.equal(completeRes.statusCode, 200);
  assert.equal(completeRes.json().status, 'COMPLETED');

  // =========================================================================
  // SECTION F: DECLINE WORKFLOW
  // =========================================================================

  // Create another referral to test DECLINE
  const draftDeclineRes = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${patient1Id}/referrals`,
    headers: { authorization: `Bearer ${sourceDocToken}` },
    payload: {
      target_facility_id: facilityTarget.id,
      target_doctor_id: targetDoc1Id,
      referral_type: 'LAB_MONITORING'
    }
  });
  const declineRef = draftDeclineRes.json();

  // Patient consents
  await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${declineRef.public_id}/consent`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });

  // Doctor sends
  await app.inject({
    method: 'POST',
    url: `/doctor/referrals/${declineRef.public_id}/send`,
    headers: { authorization: `Bearer ${sourceDocToken}` }
  });

  // Target doctor declines with structured reason
  const declineRes = await app.inject({
    method: 'POST',
    url: `/doctor/incoming-referrals/${declineRef.public_id}/decline`,
    headers: { authorization: `Bearer ${targetDoc1Token}` },
    payload: {
      reason: 'CAPACITY_UNAVAILABLE'
    }
  });
  assert.equal(declineRes.statusCode, 200);
  assert.equal(declineRes.json().status, 'DECLINED');
  assert.equal(declineRes.json().decline_reason, 'CAPACITY_UNAVAILABLE');

  // =========================================================================
  // SECTION G: COMPANION REFERRAL SUPPORT (PER-REFERRAL CONSENT GATE)
  // =========================================================================

  // Companion 1 has longitudinal assignment with Patient 1, but companion share is default OFF
  const compListOffRes = await app.inject({
    method: 'GET',
    url: '/companion/referral-support',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compListOffRes.statusCode, 200);
  const compItemsOff = compListOffRes.json().items;
  assert.ok(!compItemsOff.some((r: any) => r.public_id === patReferral.public_id), 'Unshared referral must not appear to companion');

  // Patient enables companion share for patReferral (with facility name hidden)
  const enableShareRes = await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${patReferral.public_id}/companion-share`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      is_enabled: true,
      share_target_facility: false
    }
  });
  assert.equal(enableShareRes.statusCode, 200);

  // Companion 1 now sees the generic referral status!
  const compListOnRes = await app.inject({
    method: 'GET',
    url: '/companion/referral-support',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compListOnRes.statusCode, 200);
  const sharedRef = compListOnRes.json().items.find((r: any) => r.public_id === patReferral.public_id);
  assert.ok(sharedRef, 'Shared referral must appear in companion queue');
  assert.equal(sharedRef.patient_display_alias, 'Mawar Jayapura');
  assert.equal(sharedRef.target_facility_name, null, 'Target facility name hidden when share_target_facility is false');
  assert.ok(sharedRef.generic_status_label, 'Generic non-clinical label must be provided');

  // Companion records support contact
  const compActionRes = await app.inject({
    method: 'POST',
    url: `/companion/referrals/${patReferral.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { action_type: 'CONTACT_ATTEMPTED' }
  });
  assert.equal(compActionRes.statusCode, 200);

  // Companion 2 (unassigned) CANNOT access referral support for Patient 1
  const comp2Res = await app.inject({
    method: 'GET',
    url: `/companion/patients/${patient1Id}/referral-support`,
    headers: { authorization: `Bearer ${companion2Token}` }
  });
  assert.equal(comp2Res.statusCode, 403, 'Unassigned companion must be denied');

  // Patient revokes companion share -> disappears immediately
  await app.inject({
    method: 'PATCH',
    url: `/patient/referrals/${patReferral.public_id}/companion-share`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_enabled: false }
  });

  const compListRevokedRes = await app.inject({
    method: 'GET',
    url: '/companion/referral-support',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.ok(!compListRevokedRes.json().items.some((r: any) => r.public_id === patReferral.public_id));

  // =========================================================================
  // SECTION H: CARE SIGNAL ESCALATION INTEGRATION
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

  // Create an overdue follow up care signal
  const overdueSignal = await prisma.care_signals.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      signal_type: 'FOLLOW_UP_OVERDUE',
      priority: 'ROUTINE',
      signal_scope: 'SUPPORT',
      status: 'OPEN',
      source_type: 'CONTROL_SCHEDULE',
      detected_at: now
    }
  });

  // Companion escalates to clinical
  const escActionRes = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${overdueSignal.id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { action_type: 'ESCALATED_TO_CLINICAL' }
  });
  assert.equal(escActionRes.statusCode, 200);

  // Verify separate care_referral was created with CARE_SIGNAL_ESCALATION
  const escalatedReferral = await prisma.care_referrals.findFirst({
    where: { source_care_signal_id: overdueSignal.id }
  });
  assert.ok(escalatedReferral, 'Separate referral handoff must be created');
  assert.equal(escalatedReferral.initiation_type, 'CARE_SIGNAL_ESCALATION');
  assert.equal(escalatedReferral.status, 'REQUESTED');
  assert.equal(escalatedReferral.patient_id, patient1Id);

  // =========================================================================
  // SECTION I: ADMIN GOVERNANCE AGGREGATES (ZERO PATIENT IDENTIFIERS)
  // =========================================================================

  const adminSummaryRes = await app.inject({
    method: 'GET',
    url: '/admin/governance/referrals/summary',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminSummaryRes.statusCode, 200);
  const summary = adminSummaryRes.json();
  assert.ok(typeof summary.total_requested === 'number');
  assert.ok(typeof summary.total_completed === 'number');
  assert.equal((summary as any).patient_ids, undefined, 'Admin aggregate must not contain patient IDs');
  assert.equal((summary as any).patient_names, undefined, 'Admin aggregate must not contain patient names');

  // Non-admin cannot access admin summary
  const nonAdminSummaryRes = await app.inject({
    method: 'GET',
    url: '/admin/governance/referrals/summary',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(nonAdminSummaryRes.statusCode, 403);
});
