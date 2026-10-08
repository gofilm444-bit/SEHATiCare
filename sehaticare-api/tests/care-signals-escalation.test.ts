import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-07: Care Signals, Follow-Up Overdue & Human Escalation Foundation', async () => {
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
        name: `Papua Care ${marker}`,
        code: `REG-CARE-${marker}`,
        type: 'PROVINCE',
        updated_at: now
      }
    });
  }

  const facility = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Puskesmas Care Sehati ${marker}`,
      facility_type: 'PUSKESMAS',
      region_id: region.id,
      address: 'Jl. Sehati Sentani No. 7',
      service_hours: '24 Jam',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  // Users setup
  await prisma.users.createMany({
    data: [
      { id: adminId, email: `admin-care-${marker}@test.local`, full_name: 'Admin AG07', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
      { id: patient1Id, email: `pat1-care-${marker}@test.local`, full_name: 'Pasien Satu Care', display_alias: 'Bintang Terang', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: patient2Id, email: `pat2-care-${marker}@test.local`, full_name: 'Pasien Dua Care', display_alias: 'Pelita Hati', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: doctorAId, email: `docA-care-${marker}@test.local`, full_name: 'Dr. Dokter A Care', display_alias: 'Dr. A', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: doctorBId, email: `docB-care-${marker}@test.local`, full_name: 'Dr. Dokter B Care', display_alias: 'Dr. B', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: companion1Id, email: `comp1-care-${marker}@test.local`, full_name: 'Pendamping A Care', display_alias: 'Pendamping 1', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
      { id: companion2Id, email: `comp2-care-${marker}@test.local`, full_name: 'Pendamping B Care', display_alias: 'Pendamping 2', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now }
    ]
  });

  // Companion profiles: Verified COMPANION role
  await prisma.counselor_profiles.createMany({
    data: [
      {
        user_id: companion1Id,
        facility_id: facility.id,
        professional_name: 'Pendamping 1',
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
        facility_id: facility.id,
        professional_name: 'Pendamping 2',
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

  // Doctor Profiles (Verified)
  await prisma.doctor_profiles.createMany({
    data: [
      {
        user_id: doctorAId,
        verification_status: 'VERIFIED',
        verified_at: now,
        puskesmas_name: 'RSUD Jayapura',
        str_number: `STR-A-${marker}`,
        updated_at: now
      },
      {
        user_id: doctorBId,
        verification_status: 'VERIFIED',
        verified_at: now,
        puskesmas_name: 'RS Sentani',
        str_number: `STR-B-${marker}`,
        updated_at: now
      }
    ]
  });

  // Companion 1 assigned to Patient 1 and Patient 2
  await prisma.patient_companion_assignments.createMany({
    data: [
      {
        id: randomUUID(),
        patient_user_id: patient1Id,
        companion_user_id: companion1Id,
        facility_id: facility.id,
        assigned_by_user_id: adminId,
        status: 'ACTIVE',
        started_at: now
      },
      {
        id: randomUUID(),
        patient_user_id: patient2Id,
        companion_user_id: companion1Id,
        facility_id: facility.id,
        assigned_by_user_id: adminId,
        status: 'ACTIVE',
        started_at: now
      }
    ]
  });

  // Doctor A has clinical consultation with Patient 1 (scoped)
  // Doctor A has NO relationship with Patient 2
  await prisma.consultations.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      assignedDoctorId: doctorAId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Evaluasi ART lanjutan',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  // Active HIV Care Enrollment for Patient 1
  await prisma.hiv_care_enrollments.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      facility_id: facility.id,
      status: 'ACTIVE',
      enrolled_at: now,
      created_by_user_id: adminId
    }
  });

  // Rotating login helper
  let ipCounter = 1;
  async function login(email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      remoteAddress: `127.0.7.${ipCounter++}`,
      payload: { email, password: 'Secure-test-2026!' }
    });
    assert.equal(res.statusCode, 200);
    return res.json().access_token as string;
  }

  const patient1Token = await login(`pat1-care-${marker}@test.local`);
  const patient2Token = await login(`pat2-care-${marker}@test.local`);
  const doctorAToken = await login(`docA-care-${marker}@test.local`);
  const doctorBToken = await login(`docB-care-${marker}@test.local`);
  const companion1Token = await login(`comp1-care-${marker}@test.local`);
  const companion2Token = await login(`comp2-care-${marker}@test.local`);
  const adminToken = await login(`admin-care-${marker}@test.local`);

  // =========================================================================
  // SECTION A: SEVERE SIDE EFFECT SIGNAL & PRIVACY
  // =========================================================================

  // 1. Patient 1 creates a MILD side effect -> NO severe clinical signal
  const mildSeRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/side-effects',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      symptom_name: 'Pusing ringan di pagi hari',
      severity: 'MILD'
    }
  });
  assert.equal(mildSeRes.statusCode, 201);

  let docSignalsRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docSignalsRes.statusCode, 200);
  assert.equal(docSignalsRes.headers['cache-control'], 'no-store, no-cache, must-revalidate, private');
  let severeSignals = docSignalsRes.json().items.filter((s: any) => s.signal_type === 'SEVERE_SIDE_EFFECT_REPORTED');
  assert.equal(severeSignals.length, 0);

  // 2. Patient 1 creates a SEVERE side effect -> ONE clinical signal created
  const severeSeRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/side-effects',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      symptom_name: 'Ruam hebat seluruh badan disertai demam',
      severity: 'SEVERE',
      patient_note: 'Sensitif: merasa sangat panas dan sulit bernapas'
    }
  });
  assert.equal(severeSeRes.statusCode, 201);
  const severeSeEntry = severeSeRes.json();

  docSignalsRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docSignalsRes.statusCode, 200);
  severeSignals = docSignalsRes.json().items.filter((s: any) => s.signal_type === 'SEVERE_SIDE_EFFECT_REPORTED');
  assert.equal(severeSignals.length, 1);
  assert.equal(severeSignals[0].priority, 'PRIORITY');
  assert.equal(severeSignals[0].status, 'OPEN');

  // Verify DB record: NO symptom_name, NO patient_note, NO free text in care_signals!
  const dbSideEffect = await prisma.art_side_effect_entries.findUnique({
    where: { public_id: severeSeEntry.public_id }
  });
  const dbSignal = await prisma.care_signals.findFirst({
    where: { source_type: 'SIDE_EFFECT', source_id: dbSideEffect!.id }
  });
  assert.ok(dbSignal);
  assert.equal(dbSignal.signal_type, 'SEVERE_SIDE_EFFECT_REPORTED');
  assert.equal(dbSignal.signal_scope, 'CLINICAL');
  const signalJson = JSON.stringify(dbSignal);
  assert.ok(!signalJson.includes('Ruam hebat'));
  assert.ok(!signalJson.includes('sulit bernapas'));

  // 3. Repeated sync/evaluation -> Deduplication ensures max 1 active signal
  const patchSeRes = await app.inject({
    method: 'PATCH',
    url: `/patient/art-care/side-effects/${severeSeEntry.public_id}`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { symptom_name: 'Ruam masih ada' }
  });
  assert.equal(patchSeRes.statusCode, 200);

  docSignalsRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  severeSignals = docSignalsRes.json().items.filter((s: any) => s.signal_type === 'SEVERE_SIDE_EFFECT_REPORTED');
  assert.equal(severeSignals.length, 1, 'Deduplication: exactly one active signal');

  // 4. Companion 1 CANNOT view SEVERE_SIDE_EFFECT_REPORTED (zero clinical access)
  const compSignalsRes = await app.inject({
    method: 'GET',
    url: '/companion/follow-up-signals',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compSignalsRes.statusCode, 200);
  assert.equal(compSignalsRes.headers['cache-control'], 'no-store, no-cache, must-revalidate, private');
  const compSevere = compSignalsRes.json().items.filter((s: any) => s.signal_type === 'SEVERE_SIDE_EFFECT_REPORTED');
  assert.equal(compSevere.length, 0, 'Companion receives ZERO severe side-effect signals');

  // 5. Unrelated Doctor B CANNOT view Patient 1's care signals
  const docBPatientRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/care-signals`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBPatientRes.statusCode, 403, 'Unrelated doctor denied access');

  // 6. Side effect resolved -> Signal auto-resolves
  const resolveSeRes = await app.inject({
    method: 'PATCH',
    url: `/patient/art-care/side-effects/${severeSeEntry.public_id}`,
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { status: 'RESOLVED' }
  });
  assert.equal(resolveSeRes.statusCode, 200);

  const dbSignalAfter = await prisma.care_signals.findUnique({
    where: { id: dbSignal.id }
  });
  assert.equal(dbSignalAfter?.status, 'RESOLVED', 'Auto-resolved when source side effect resolves');

  // =========================================================================
  // SECTION B: FOLLOW-UP OVERDUE SIGNALS & BUCKETS
  // =========================================================================

  // 1. Future control schedule -> NO overdue signal
  const futureDate = new Date(Date.now() + 5 * 86400_000);
  const futureSchedule = await prisma.control_schedules.create({
    data: {
      id: randomUUID(),
      user_id: patient1Id,
      worker_id: doctorAId,
      facility_id: facility.id,
      starts_at: futureDate,
      timezone: 'Asia/Jayapura',
      control_type: 'KONTROL_RUTIN',
      status: 'SCHEDULED',
      source: 'USER',
      created_by: patient1Id,
      updated_by: patient1Id,
      updated_at: now
    }
  });

  let patSignalsRes = await app.inject({
    method: 'GET',
    url: '/patient/care-signals',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(patSignalsRes.statusCode, 200);
  let overdueSignals = patSignalsRes.json().items.filter((s: any) => s.signal_type === 'FOLLOW_UP_OVERDUE');
  assert.equal(overdueSignals.length, 0, 'Future schedule has no overdue signal');

  // 2. Past control schedule (overdue by 4 days) -> FOLLOW_UP_OVERDUE signal
  const pastDate4Days = new Date(Date.now() - 4 * 86400_000);
  const overdueSchedule = await prisma.control_schedules.create({
    data: {
      id: randomUUID(),
      user_id: patient1Id,
      worker_id: doctorAId,
      facility_id: facility.id,
      starts_at: pastDate4Days,
      timezone: 'Asia/Jayapura',
      control_type: 'KONTROL_RUTIN',
      status: 'SCHEDULED',
      source: 'USER',
      created_by: patient1Id,
      updated_by: patient1Id,
      updated_at: now
    }
  });

  patSignalsRes = await app.inject({
    method: 'GET',
    url: '/patient/care-signals',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(patSignalsRes.statusCode, 200);
  overdueSignals = patSignalsRes.json().items.filter((s: any) => s.signal_type === 'FOLLOW_UP_OVERDUE');
  assert.equal(overdueSignals.length, 1, 'Past schedule generates FOLLOW_UP_OVERDUE signal');
  assert.equal(overdueSignals[0].display_title, 'Jadwal Kontrol Telah Terlewat');

  // Verify language: NEVER label patient as "lost to follow-up" or "LTFU"
  const patSignalJson = JSON.stringify(patSignalsRes.json());
  assert.ok(!patSignalJson.toUpperCase().includes('LOST TO FOLLOW-UP'));
  assert.ok(!patSignalJson.toUpperCase().includes('LTFU'));

  // Doctor view has coarse bucket
  docSignalsRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  const docOverdue = docSignalsRes.json().items.find((s: any) => s.signal_type === 'FOLLOW_UP_OVERDUE');
  assert.ok(docOverdue);
  assert.equal(docOverdue.overdue_bucket, '1_TO_7_DAYS');

  // 3. Completing the schedule auto-resolves the overdue signal
  const completeScheduleRes = await app.inject({
    method: 'POST',
    url: `/control-schedules/${overdueSchedule.public_id}/complete`,
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(completeScheduleRes.statusCode, 200);

  const overdueDbSignal = await prisma.care_signals.findFirst({
    where: { source_type: 'CONTROL_SCHEDULE', source_id: overdueSchedule.id }
  });
  assert.equal(overdueDbSignal?.status, 'RESOLVED', 'Overdue signal auto-resolves when schedule is completed');

  // =========================================================================
  // SECTION C: REFILL NEEDS ATTENTION & CONSENT SEPARATION
  // =========================================================================

  // 1. Stock with estimated_days_remaining = 14 (OK) -> NO refill signal
  const stockOkRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { quantity_remaining: 28, estimated_days_remaining: 14 }
  });
  assert.equal(stockOkRes.statusCode, 201);

  patSignalsRes = await app.inject({
    method: 'GET',
    url: '/patient/care-signals',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  let refillSignals = patSignalsRes.json().items.filter((s: any) => s.signal_type === 'REFILL_NEEDS_ATTENTION');
  assert.equal(refillSignals.length, 0, 'OK stock does not generate refill signal');

  // 2. Stock with estimated_days_remaining = 5 (DUE_SOON) -> NO auto-escalation!
  const stockDueSoonRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { quantity_remaining: 10, estimated_days_remaining: 5 }
  });
  assert.equal(stockDueSoonRes.statusCode, 201);

  patSignalsRes = await app.inject({
    method: 'GET',
    url: '/patient/care-signals',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  refillSignals = patSignalsRes.json().items.filter((s: any) => s.signal_type === 'REFILL_NEEDS_ATTENTION');
  assert.equal(refillSignals.length, 0, 'DUE_SOON stock does NOT auto-escalate in AG-07');

  // 3. Stock with estimated_days_remaining = 0 (NEEDS_ATTENTION) -> Creates REFILL_NEEDS_ATTENTION signal
  const stockNeedsAttRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { quantity_remaining: 0, estimated_days_remaining: 0 }
  });
  assert.equal(stockNeedsAttRes.statusCode, 201);

  patSignalsRes = await app.inject({
    method: 'GET',
    url: '/patient/care-signals',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  refillSignals = patSignalsRes.json().items.filter((s: any) => s.signal_type === 'REFILL_NEEDS_ATTENTION');
  assert.equal(refillSignals.length, 1, 'NEEDS_ATTENTION stock generates refill signal');
  assert.equal(refillSignals[0].display_title, 'Persediaan Kesehatan Perlu Diperiksa');

  // 4. Companion visibility requires AG-06 refill support consent
  // When consent is OFF -> Companion 1 cannot see refill signal
  let compRefillSignals = (
    await app.inject({
      method: 'GET',
      url: '/companion/follow-up-signals',
      headers: { authorization: `Bearer ${companion1Token}` }
    })
  ).json().items.filter((s: any) => s.signal_type === 'REFILL_NEEDS_ATTENTION');
  assert.equal(compRefillSignals.length, 0, 'Refill signal hidden from companion when refill consent is OFF');

  // Enable refill consent for Patient 1
  await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/refill-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });

  // Now Companion 1 can see generic refill signal
  compRefillSignals = (
    await app.inject({
      method: 'GET',
      url: '/companion/follow-up-signals',
      headers: { authorization: `Bearer ${companion1Token}` }
    })
  ).json().items.filter((s: any) => s.signal_type === 'REFILL_NEEDS_ATTENTION');
  assert.equal(compRefillSignals.length, 1, 'Companion can see refill signal when refill consent is ON');
  assert.equal(compRefillSignals[0].support_title, 'Persediaan kesehatan perlu diperiksa');

  // PRIVACY: Companion payload must NOT have exact quantity, drug name, or notes
  const compRefillJson = JSON.stringify(compRefillSignals[0]);
  assert.ok(!compRefillJson.includes('quantity_remaining'));
  assert.ok(!compRefillJson.includes('ARV'));

  // 5. Patient logs restocked medication (estimated_days_remaining = 30) -> auto-resolves refill signal
  await app.inject({
    method: 'POST',
    url: '/patient/art-care/stock',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { quantity_remaining: 60, estimated_days_remaining: 30 }
  });

  patSignalsRes = await app.inject({
    method: 'GET',
    url: '/patient/care-signals',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  refillSignals = patSignalsRes.json().items.filter((s: any) => s.signal_type === 'REFILL_NEEDS_ATTENTION');
  assert.equal(refillSignals.length, 0, 'Refill signal resolved when stock is replenished');

  // =========================================================================
  // SECTION D: PATIENT-REQUESTED HUMAN SUPPORT & FOLLOW-UP CONSENT
  // =========================================================================

  // 1. Patient requests clinical contact (doctor-facing only)
  const reqClinicalRes = await app.inject({
    method: 'POST',
    url: '/patient/care-signals/request-clinical-contact',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      category: 'FOLLOW_UP_HELP',
      preferred_contact_time: 'MORNING'
    }
  });
  assert.equal(reqClinicalRes.statusCode, 201);
  const clinicalSignal = reqClinicalRes.json();
  assert.equal(clinicalSignal.signal_type, 'PATIENT_REQUESTED_CLINICAL_CONTACT');
  assert.equal(clinicalSignal.priority, 'PRIORITY');

  // Visible to Doctor A within clinical relationship
  docSignalsRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  const docClinicalReq = docSignalsRes.json().items.find((s: any) => s.signal_type === 'PATIENT_REQUESTED_CLINICAL_CONTACT');
  assert.ok(docClinicalReq);
  assert.equal(docClinicalReq.request_category, 'FOLLOW_UP_HELP');
  assert.equal(docClinicalReq.preferred_contact_time, 'MORNING');

  // Companion 1 receives ZERO clinical contact signals
  const compClinicalSignals = (
    await app.inject({
      method: 'GET',
      url: '/companion/follow-up-signals',
      headers: { authorization: `Bearer ${companion1Token}` }
    })
  ).json().items.filter((s: any) => s.signal_type === 'PATIENT_REQUESTED_CLINICAL_CONTACT');
  assert.equal(compClinicalSignals.length, 0, 'Clinical contact request is hidden from companion');

  // 2. Follow-Up Support Consent default is OFF
  const consentGetRes = await app.inject({
    method: 'GET',
    url: '/patient/care/follow-up-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(consentGetRes.statusCode, 200);
  assert.equal(consentGetRes.json().is_consent_enabled, false, 'Default follow-up consent is OFF');

  // 3. Request companion support while consent is OFF -> Rejected (400)
  const reqCompConsentOff = await app.inject({
    method: 'POST',
    url: '/patient/care-signals/request-companion-support',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { preferred_contact_time: 'AFTERNOON' }
  });
  assert.equal(reqCompConsentOff.statusCode, 400);

  // 4. Grant follow-up consent
  const consentPatchRes = await app.inject({
    method: 'PATCH',
    url: '/patient/care/follow-up-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(consentPatchRes.statusCode, 200);
  assert.equal(consentPatchRes.json().is_consent_enabled, true);

  // 5. Request companion support now succeeds
  const reqCompConsentOn = await app.inject({
    method: 'POST',
    url: '/patient/care-signals/request-companion-support',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { preferred_contact_time: 'AFTERNOON' }
  });
  assert.equal(reqCompConsentOn.statusCode, 201);
  const compReqSignal = reqCompConsentOn.json();
  assert.equal(compReqSignal.signal_type, 'PATIENT_REQUESTED_COMPANION_SUPPORT');

  // Companion 1 can now view the support request
  let compFollowUpRes = await app.inject({
    method: 'GET',
    url: '/companion/follow-up-signals',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  let compReqItem = compFollowUpRes.json().items.find((s: any) => s.signal_type === 'PATIENT_REQUESTED_COMPANION_SUPPORT');
  assert.ok(compReqItem);
  assert.equal(compReqItem.support_title, 'Pengguna meminta dukungan');

  // 6. Revoking follow-up consent immediately removes signal from companion queue
  await app.inject({
    method: 'PATCH',
    url: '/patient/care/follow-up-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: false }
  });

  compFollowUpRes = await app.inject({
    method: 'GET',
    url: '/companion/follow-up-signals',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  compReqItem = compFollowUpRes.json().items.find((s: any) => s.signal_type === 'PATIENT_REQUESTED_COMPANION_SUPPORT');
  assert.equal(compReqItem, undefined, 'Revocation immediately blocks companion access');

  // Re-enable for subsequent testing
  await app.inject({
    method: 'PATCH',
    url: '/patient/care/follow-up-support-consent',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: { is_consent_enabled: true }
  });

  // =========================================================================
  // SECTION E: DOCTOR SCOPE & COMPANION ISOLATION REGRESSION
  // =========================================================================

  // Patient 2 has active companion assignment with Companion 1, but NO doctor relationship with Doctor A
  // 1. Doctor A attempts to access Patient 2 care signals -> 403 Forbidden
  const docAPat2Res = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient2Id}/care-signals`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docAPat2Res.statusCode, 403, 'Doctor cannot access patient without clinical relationship');

  // 2. Doctor A's general queue never includes Patient 2
  const docAAllRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  const pat2SignalsForDocA = docAAllRes.json().items.filter((s: any) => s.patient_public_id === patient2Id);
  assert.equal(pat2SignalsForDocA.length, 0, 'Doctor cannot see signals for unscoped patient in list queue');

  // =========================================================================
  // SECTION F: HUMAN FOLLOW-UP ACTIONS & TRANSITIONS
  // =========================================================================

  // Doctor A acknowledges the clinical contact signal
  const ackRes = await app.inject({
    method: 'PATCH',
    url: `/doctor/care-signals/${clinicalSignal.public_id}/status`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: { status: 'ACKNOWLEDGED' }
  });
  assert.equal(ackRes.statusCode, 200);
  assert.equal(ackRes.json().status, 'ACKNOWLEDGED');

  // Doctor A records follow-up action with scheduled date
  const nextDate = new Date(Date.now() + 2 * 86400_000).toISOString();
  const docActionRes = await app.inject({
    method: 'POST',
    url: `/doctor/care-signals/${clinicalSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: {
      action_type: 'FOLLOW_UP_SCHEDULED',
      next_follow_up_at: nextDate
    }
  });
  assert.equal(docActionRes.statusCode, 200);
  assert.ok(docActionRes.json().actions.length >= 2);

  // Companion attempts to RESOLVE or DISMISS -> Rejected (400 by validator, or 403/404)
  // Companion cannot resolve clinical signals!
  const companionActionInvalid = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${clinicalSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { action_type: 'RESOLVED' as any }
  });
  assert.ok([400, 403, 404].includes(companionActionInvalid.statusCode));

  // Companion attempts an allowed action type on a clinical signal -> 404 (hidden from companion)
  const companionClinicalIsolation = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${clinicalSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { action_type: 'CONTACT_ATTEMPTED' }
  });
  assert.equal(companionClinicalIsolation.statusCode, 404, 'Clinical signal hidden from companion action endpoint');

  // Companion records allowed support action on companion request signal
  const compActionRes = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${compReqSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: {
      action_type: 'CONTACT_ATTEMPTED'
    }
  });
  assert.equal(compActionRes.statusCode, 200);
  assert.equal(compActionRes.json().actions[0].action_type, 'CONTACT_ATTEMPTED');

  // Companion escalates support signal to clinical
  const compEscalateRes = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${compReqSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: {
      action_type: 'ESCALATED_TO_CLINICAL'
    }
  });
  assert.equal(compEscalateRes.statusCode, 200);

  // Doctor A resolves the clinical contact signal
  const resolveRes = await app.inject({
    method: 'PATCH',
    url: `/doctor/care-signals/${clinicalSignal.public_id}/status`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: { status: 'RESOLVED' }
  });
  assert.equal(resolveRes.statusCode, 200);
  assert.equal(resolveRes.json().status, 'RESOLVED');

  // Cannot transition from RESOLVED to ACKNOWLEDGED (409)
  const invalidReopenRes = await app.inject({
    method: 'PATCH',
    url: `/doctor/care-signals/${clinicalSignal.public_id}/status`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: { status: 'ACKNOWLEDGED' }
  });
  assert.equal(invalidReopenRes.statusCode, 409);

  // =========================================================================
  // SECTION G: ADMIN GOVERNANCE AGGREGATE SUMMARY
  // =========================================================================

  const adminSummaryRes = await app.inject({
    method: 'GET',
    url: '/admin/governance/care-signals/summary',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminSummaryRes.statusCode, 200);
  const summary = adminSummaryRes.json();
  assert.ok(typeof summary.total_open === 'number');
  assert.ok(typeof summary.total_acknowledged === 'number');
  assert.ok(typeof summary.total_resolved === 'number');
  assert.ok(summary.by_type);
  assert.ok(summary.by_scope);

  // Ensure Admin endpoint has NO patient identities or free text
  const adminSummaryJson = JSON.stringify(summary);
  assert.ok(!adminSummaryJson.includes(patient1Id));
  assert.ok(!adminSummaryJson.includes('Bintang Terang'));
  assert.ok(!adminSummaryJson.includes('Pelita Hati'));

  // Non-admin role cannot access admin governance summary
  const patSummaryRes = await app.inject({
    method: 'GET',
    url: '/admin/governance/care-signals/summary',
    headers: { authorization: `Bearer ${patient1Token}` }
  });
  assert.equal(patSummaryRes.statusCode, 403);
});

test('AG-07A: Care Signal Dedupe, Metadata Whitelist, Unassigned Routing & Escalation Isolation Audit', async () => {
  const app = await buildApp();
  const marker = randomUUID().slice(0, 8);
  const now = new Date();
  const passwordHash = await bcrypt.hash('Secure-test-2026!', 12);

  // Setup Region & Facility
  let region = await prisma.regions.findFirst();
  if (!region) {
    region = await prisma.regions.create({
      data: {
        id: randomUUID(),
        name: `Papua Audit ${marker}`,
        code: `REG-AUDIT-${marker}`,
        type: 'PROVINCE',
        updated_at: now
      }
    });
  }

  const facility = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Puskesmas Audit ${marker}`,
      facility_type: 'PUSKESMAS',
      region_id: region.id,
      address: 'Jl. Sehati Sentani No. 9',
      service_hours: '24 Jam',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  // Users: Admin, Patient 1 (has doctor A), Patient 2 (unassigned), Doctor A, Doctor B (unrelated), Companion 1
  const adminId = randomUUID();
  const patient1Id = randomUUID();
  const patient2Id = randomUUID(); // unassigned clinical request patient
  const doctorAId = randomUUID();
  const doctorBId = randomUUID(); // unrelated doctor
  const companion1Id = randomUUID();

  await prisma.users.createMany({
    data: [
      { id: adminId, email: `admin-a7a-${marker}@test.local`, full_name: 'Admin A7A', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
      { id: patient1Id, email: `pat1-a7a-${marker}@test.local`, full_name: 'Pasien 1 A7A', display_alias: 'Pelita Fajar', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: patient2Id, email: `pat2-a7a-${marker}@test.local`, full_name: 'Pasien 2 A7A', display_alias: 'Bintang Timur', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: doctorAId, email: `docA-a7a-${marker}@test.local`, full_name: 'Dr. A A7A', display_alias: 'Dr. A', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: doctorBId, email: `docB-a7a-${marker}@test.local`, full_name: 'Dr. B A7A', display_alias: 'Dr. B', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: companion1Id, email: `comp1-a7a-${marker}@test.local`, full_name: 'Pendamping 1 A7A', display_alias: 'Pendamping 1', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now }
    ]
  });

  // Profiles
  await prisma.doctor_profiles.createMany({
    data: [
      { user_id: doctorAId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'RSUD Jayapura', str_number: `STR-A7A-${marker}`, updated_at: now },
      { user_id: doctorBId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'RS Sentani', str_number: `STR-A7B-${marker}`, updated_at: now }
    ]
  });

  await prisma.counselor_profiles.create({
    data: {
      user_id: companion1Id,
      facility_id: facility.id,
      professional_name: 'Pendamping A7A',
      profession: 'Pendamping Komunitas',
      service_role: 'COMPANION',
      verification_status: 'VERIFIED',
      permission_enabled: true,
      verified_at: now,
      is_active: true,
      updated_at: now
    }
  });

  // Companion assignment: Patient 1 is assigned to Companion 1
  // Patient 2 has NO companion assignment
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

  // Doctor A has clinical consultation with Patient 1
  // Neither Doctor A nor Doctor B has any clinical relationship with Patient 2
  await prisma.consultations.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      assignedDoctorId: doctorAId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Evaluasi ART',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  // Enable follow-up and refill consents for Patient 1
  await prisma.care_follow_up_support_consents.create({
    data: {
      id: randomUUID(),
      patient_id: patient1Id,
      is_consent_enabled: true,
      consented_at: now
    }
  });

  await prisma.art_refill_support_consents.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      is_consent_enabled: true,
      consented_at: now
    }
  });

  const adminToken = app.auth.signAccessToken({ userId: adminId, role: 'ADMIN', sessionVersion: 0 });
  const patient1Token = app.auth.signAccessToken({ userId: patient1Id, role: 'PASIEN', sessionVersion: 0 });
  const patient2Token = app.auth.signAccessToken({ userId: patient2Id, role: 'PASIEN', sessionVersion: 0 });
  const doctorAToken = app.auth.signAccessToken({ userId: doctorAId, role: 'DOKTER', sessionVersion: 0 });
  const doctorBToken = app.auth.signAccessToken({ userId: doctorBId, role: 'DOKTER', sessionVersion: 0 });
  const companion1Token = app.auth.signAccessToken({ userId: companion1Id, role: 'COUNSELOR', sessionVersion: 0 });

  // =========================================================================
  // 1. ACTIVE SIGNAL DEDUPE AUDIT (OPEN + ACKNOWLEDGED)
  // =========================================================================

  // A. Overdue Control Schedule Dedupe across OPEN and ACKNOWLEDGED
  const pastScheduleDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days ago
  const overdueSchedule = await prisma.control_schedules.create({
    data: {
      id: randomUUID(),
      user_id: patient1Id,
      facility_id: facility.id,
      starts_at: pastScheduleDate,
      timezone: 'Asia/Jayapura',
      control_type: 'KONTROL_RUTIN',
      status: 'SCHEDULED',
      source: 'USER',
      created_by: patient1Id,
      updated_by: patient1Id,
      updated_at: now
    }
  });

  // Step 1: Initial evaluation -> Creates ONE OPEN signal
  const { syncControlScheduleSignal, evaluateOverdueControlSchedules, syncSevereSideEffectSignal, syncRefillStockSignal } = await import(
    '../src/modules/care/careSignals.service'
  );

  const signal1 = await syncControlScheduleSignal(overdueSchedule.id);
  assert.ok(signal1);
  assert.equal(signal1.status, 'OPEN');

  // Verify DB count
  let scheduleSignals = await prisma.care_signals.findMany({
    where: { source_type: 'CONTROL_SCHEDULE', source_id: overdueSchedule.id }
  });
  assert.equal(scheduleSignals.length, 1);

  // Step 2: Doctor A acknowledges the signal
  const ackRes = await app.inject({
    method: 'PATCH',
    url: `/doctor/care-signals/${signal1.public_id}/status`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: { status: 'ACKNOWLEDGED' }
  });
  assert.equal(ackRes.statusCode, 200);
  assert.equal(ackRes.json().status, 'ACKNOWLEDGED');

  // Step 3: Run evaluator repeatedly while signal is ACKNOWLEDGED
  await syncControlScheduleSignal(overdueSchedule.id);
  await syncControlScheduleSignal(overdueSchedule.id);
  await evaluateOverdueControlSchedules();

  // Invariant check: MUST remain exactly ONE signal, and status must remain ACKNOWLEDGED
  scheduleSignals = await prisma.care_signals.findMany({
    where: { source_type: 'CONTROL_SCHEDULE', source_id: overdueSchedule.id }
  });
  assert.equal(scheduleSignals.length, 1, 'Repeated evaluation must not create a duplicate signal while ACKNOWLEDGED');
  assert.equal(scheduleSignals[0].status, 'ACKNOWLEDGED');

  // Step 4: Resolve the schedule (e.g. completed) -> signal resolves
  await prisma.control_schedules.update({
    where: { id: overdueSchedule.id },
    data: { status: 'COMPLETED', completed_at: new Date() }
  });
  await syncControlScheduleSignal(overdueSchedule.id);

  scheduleSignals = await prisma.care_signals.findMany({
    where: { source_type: 'CONTROL_SCHEDULE', source_id: overdueSchedule.id }
  });
  assert.equal(scheduleSignals.length, 1);
  assert.equal(scheduleSignals[0].status, 'RESOLVED');

  // Step 5: A genuinely new schedule later creates a new distinct historical signal
  const newSchedule = await prisma.control_schedules.create({
    data: {
      id: randomUUID(),
      user_id: patient1Id,
      facility_id: facility.id,
      starts_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      timezone: 'Asia/Jayapura',
      control_type: 'KONTROL_RUTIN',
      status: 'SCHEDULED',
      source: 'USER',
      created_by: patient1Id,
      updated_by: patient1Id,
      updated_at: now
    }
  });

  const signal2 = await syncControlScheduleSignal(newSchedule.id);
  assert.ok(signal2);
  assert.equal(signal2.status, 'OPEN');
  assert.notEqual(signal2.id, signal1.id);

  // Total signals for patient1 now includes historical resolved + new open
  const allPatient1ScheduleSignals = await prisma.care_signals.findMany({
    where: { patient_id: patient1Id, source_type: 'CONTROL_SCHEDULE' }
  });
  assert.equal(allPatient1ScheduleSignals.length, 2);

  // B. Severe Side Effect Dedupe across OPEN and ACKNOWLEDGED
  const severeEntry = await prisma.art_side_effect_entries.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      symptom_name: 'Sesak napas akut',
      severity: 'SEVERE',
      status: 'ACTIVE'
    }
  });

  const seSignal = await syncSevereSideEffectSignal(severeEntry.id);
  assert.ok(seSignal);
  assert.equal(seSignal.status, 'OPEN');

  // Acknowledge SE signal
  await app.inject({
    method: 'PATCH',
    url: `/doctor/care-signals/${seSignal.public_id}/status`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: { status: 'ACKNOWLEDGED' }
  });

  // Re-run sync repeatedly while ACKNOWLEDGED
  await syncSevereSideEffectSignal(severeEntry.id);
  await syncSevereSideEffectSignal(severeEntry.id);

  const seSignalsInDb = await prisma.care_signals.findMany({
    where: { source_type: 'SIDE_EFFECT', source_id: severeEntry.id }
  });
  assert.equal(seSignalsInDb.length, 1, 'Severe side effect evaluator must not duplicate signal while ACKNOWLEDGED');
  assert.equal(seSignalsInDb[0].status, 'ACKNOWLEDGED');

  // C. Refill Stock Dedupe across OPEN and ACKNOWLEDGED
  await prisma.art_medication_stocks.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      estimated_days_remaining: 0,
      quantity_remaining: 0
    }
  });

  const refillSignal = await syncRefillStockSignal(patient1Id);
  assert.ok(refillSignal);
  assert.equal(refillSignal.status, 'OPEN');

  // Acknowledge Refill signal
  await app.inject({
    method: 'PATCH',
    url: `/doctor/care-signals/${refillSignal.public_id}/status`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: { status: 'ACKNOWLEDGED' }
  });

  // Re-run refill sync repeatedly
  await syncRefillStockSignal(patient1Id);
  await syncRefillStockSignal(patient1Id);

  const refillSignalsInDb = await prisma.care_signals.findMany({
    where: { patient_id: patient1Id, signal_type: 'REFILL_NEEDS_ATTENTION' }
  });
  assert.equal(refillSignalsInDb.length, 1, 'Refill sync must not duplicate signal while ACKNOWLEDGED');
  assert.equal(refillSignalsInDb[0].status, 'ACKNOWLEDGED');

  // =========================================================================
  // 2. METADATA PRIVACY & ARBITRARY CLIENT DATA REJECTION AUDIT
  // =========================================================================

  // Client attempts to submit arbitrary metadata or sensitive clinical fields
  const maliciousContactReq = await app.inject({
    method: 'POST',
    url: '/patient/care-signals/request-clinical-contact',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      category: 'OTHER',
      metadata: { leaked_note: 'sensitif', diagnosis: 'HIV stadium 3' },
      free_text: 'injeksi teks bebas'
    }
  });
  assert.equal(maliciousContactReq.statusCode, 400, 'Arbitrary client metadata and unexpected fields must be rejected');

  const maliciousCompanionReq = await app.inject({
    method: 'POST',
    url: '/patient/care-signals/request-companion-support',
    headers: { authorization: `Bearer ${patient1Token}` },
    payload: {
      preferred_contact_time: 'MORNING',
      metadata: { private_key: 'malicious' },
      notes: 'teks terlarang'
    }
  });
  assert.equal(maliciousCompanionReq.statusCode, 400, 'Arbitrary metadata on companion request must be rejected');

  const maliciousDoctorAction = await app.inject({
    method: 'POST',
    url: `/doctor/care-signals/${signal2.public_id}/actions`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: {
      action_type: 'CONTACTED',
      metadata: { raw_note: 'clinical notes' }
    }
  });
  assert.equal(maliciousDoctorAction.statusCode, 400, 'Arbitrary metadata on doctor action must be rejected');

  const maliciousCompanionAction = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${refillSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: {
      action_type: 'CONTACTED',
      metadata: { drug_name: 'Efavirenz' }
    }
  });
  assert.equal(maliciousCompanionAction.statusCode, 400, 'Arbitrary metadata on companion action must be rejected');

  // Verify Companion payload never leaks raw metadata or clinical fields
  const compPayloadRes = await app.inject({
    method: 'GET',
    url: `/companion/patients/${patient1Id}/follow-up-signals`,
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compPayloadRes.statusCode, 200);
  const compItems = compPayloadRes.json().items;
  assert.ok(compItems.length > 0);
  for (const item of compItems) {
    assert.equal(item.metadata, undefined, 'Raw metadata must never be exposed to companion');
    assert.equal(item.request_category, undefined, 'Request category must not leak to companion');
    assert.equal(item.symptom_name, undefined);
    assert.equal(item.medication_name, undefined);
    assert.equal(item.notes, undefined);
  }

  // Verify Admin governance summary never returns metadata or patient records
  const adminGovRes = await app.inject({
    method: 'GET',
    url: '/admin/governance/care-signals/summary',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminGovRes.statusCode, 200);
  const adminSummary = adminGovRes.json();
  assert.equal(adminSummary.metadata, undefined);
  assert.equal(adminSummary.items, undefined);
  assert.equal(adminSummary.signals, undefined);

  // =========================================================================
  // 3. UNASSIGNED CLINICAL REQUEST ROUTING SECURITY AUDIT
  // =========================================================================

  // Patient 2 has NO relationship with Doctor A or Doctor B, and NO companion
  const unassignedReq = await app.inject({
    method: 'POST',
    url: '/patient/care-signals/request-clinical-contact',
    headers: { authorization: `Bearer ${patient2Token}` },
    payload: {
      category: 'GENERAL_HEALTH_SUPPORT',
      preferred_contact_time: 'AFTERNOON'
    }
  });
  assert.equal(unassignedReq.statusCode, 201);
  const unassignedSignal = unassignedReq.json();
  assert.equal(unassignedSignal.status, 'OPEN');
  assert.equal(unassignedSignal.display_title, 'Permintaan Kontak Tenaga Kesehatan');
  assert.equal(unassignedSignal.cta.label, 'Menunggu Tindak Lanjut');

  // Verify DB state: signal exists and is unassigned (source_id is null)
  const dbUnassigned = await prisma.care_signals.findUnique({
    where: { public_id: unassignedSignal.public_id }
  });
  assert.ok(dbUnassigned);
  assert.equal(dbUnassigned.patient_id, patient2Id);
  assert.equal(dbUnassigned.source_id, null);

  // A. Unrelated Doctor B cannot read unassigned clinical request in list
  const docBListRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBListRes.statusCode, 200);
  const docBItems = docBListRes.json().items;
  assert.ok(!docBItems.some((s: any) => s.public_id === unassignedSignal.public_id), 'Unrelated Doctor B must not see unassigned request');

  // B. Unrelated Doctor B cannot access via patient detail endpoint (403)
  const docBPatientRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient2Id}/care-signals`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBPatientRes.statusCode, 403, 'Unrelated doctor must be denied on unscoped patient');

  // C. Admin cannot read patient-level clinical request (403)
  const adminDetailRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient2Id}/care-signals`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminDetailRes.statusCode, 403, 'Admin must not have access to clinical patient signals');

  // D. Companion cannot read unassigned clinical request
  const compUnassignedListRes = await app.inject({
    method: 'GET',
    url: '/companion/follow-up-signals',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compUnassignedListRes.statusCode, 200);
  assert.ok(
    !compUnassignedListRes.json().items.some((s: any) => s.public_id === unassignedSignal.public_id),
    'Companion must never see clinical contact request'
  );

  // E. Patient 2 can safely see own unassigned request
  const pat2SignalsRes = await app.inject({
    method: 'GET',
    url: '/patient/care-signals',
    headers: { authorization: `Bearer ${patient2Token}` }
  });
  assert.equal(pat2SignalsRes.statusCode, 200);
  const pat2Item = pat2SignalsRes.json().items.find((s: any) => s.public_id === unassignedSignal.public_id);
  assert.ok(pat2Item);
  assert.equal(pat2Item.display_title, 'Permintaan Kontak Tenaga Kesehatan');
  assert.equal(pat2Item.cta.label, 'Menunggu Tindak Lanjut');

  // F. Once legitimate clinical relationship is established with Doctor A:
  await prisma.consultations.create({
    data: {
      id: randomUUID(),
      patient_id: patient2Id,
      assignedDoctorId: doctorAId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Konsultasi awal pasca-permintaan',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  // Now Doctor A (scoped) can view the request
  const docAPatient2Res = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient2Id}/care-signals`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docAPatient2Res.statusCode, 200);
  assert.ok(docAPatient2Res.json().items.some((s: any) => s.public_id === unassignedSignal.public_id));

  // Doctor B remains unrelated and STILL denied (403)
  const docBPatient2StillDenied = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient2Id}/care-signals`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBPatient2StillDenied.statusCode, 403);

  // =========================================================================
  // 4. SUPPORT -> CLINICAL ESCALATION ISOLATION AUDIT
  // =========================================================================

  // Companion 1 escalates the refill signal of Patient 1 to clinical
  const escalateRefillRes = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${refillSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { action_type: 'ESCALATED_TO_CLINICAL' }
  });
  assert.equal(escalateRefillRes.statusCode, 200);

  // Check 1: Companion cannot access doctor clinical endpoint
  const compDocEndpointRes = await app.inject({
    method: 'GET',
    url: '/doctor/care-signals',
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compDocEndpointRes.statusCode, 403, 'Companion must not access doctor endpoints after escalating');

  // Check 2: Companion cannot view severe side effect signal
  const compSevereActionRes = await app.inject({
    method: 'POST',
    url: `/companion/care-signals/${seSignal.public_id}/actions`,
    headers: { authorization: `Bearer ${companion1Token}` },
    payload: { action_type: 'ACKNOWLEDGED' }
  });
  assert.equal(compSevereActionRes.statusCode, 404, 'Companion must receive 404 on clinical side effect signal');

  // Check 3: Escalated signal in companion view still uses safe generic title
  const compRefillViewRes = await app.inject({
    method: 'GET',
    url: `/companion/patients/${patient1Id}/follow-up-signals`,
    headers: { authorization: `Bearer ${companion1Token}` }
  });
  assert.equal(compRefillViewRes.statusCode, 200);
  const compRefillItem = compRefillViewRes.json().items.find((s: any) => s.public_id === refillSignal.public_id);
  assert.ok(compRefillItem);
  assert.equal(compRefillItem.support_title, 'Persediaan kesehatan perlu diperiksa');
  assert.ok(!JSON.stringify(compRefillItem).includes('Efavirenz'));

  // Check 4: Unrelated Doctor B still cannot access Patient 1 signals
  const docBPatient1Res = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/care-signals`,
    headers: { authorization: `Bearer ${doctorBToken}` }
  });
  assert.equal(docBPatient1Res.statusCode, 403, 'Escalation by companion does not expose signal to unrelated doctors');

  // Check 5: Scoped Doctor A sees escalated priority
  const docAPatient1Res = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${patient1Id}/care-signals`,
    headers: { authorization: `Bearer ${doctorAToken}` }
  });
  assert.equal(docAPatient1Res.statusCode, 200);
  const docRefillItem = docAPatient1Res.json().items.find((s: any) => s.public_id === refillSignal.public_id);
  assert.ok(docRefillItem);
  assert.equal(docRefillItem.priority, 'PRIORITY');
  assert.equal(docRefillItem.signal_scope, 'CLINICAL');
  assert.ok(docRefillItem.actions.some((a: any) => a.action_type === 'ESCALATED_TO_CLINICAL'));

  // =========================================================================
  // 5. HISTORY & AUDIT PRESERVATION CONFIRMATION
  // =========================================================================

  // Doctor A resolves the escalated refill signal
  const resolveRefillRes = await app.inject({
    method: 'PATCH',
    url: `/doctor/care-signals/${refillSignal.public_id}/status`,
    headers: { authorization: `Bearer ${doctorAToken}` },
    payload: { status: 'RESOLVED' }
  });
  assert.equal(resolveRefillRes.statusCode, 200);

  // Confirm signal is NOT deleted from DB
  const resolvedSignalInDb = await prisma.care_signals.findUnique({
    where: { public_id: refillSignal.public_id }
  });
  assert.ok(resolvedSignalInDb, 'Resolved signal must remain in database');
  assert.equal(resolvedSignalInDb.status, 'RESOLVED');

  // Confirm actions history is preserved completely
  const actionsInDb = await prisma.care_signal_actions.findMany({
    where: { care_signal_id: resolvedSignalInDb.id },
    orderBy: { occurred_at: 'asc' }
  });
  assert.ok(actionsInDb.length >= 2, 'Action history must be preserved');
  const actionTypes = actionsInDb.map((a) => a.action_type);
  assert.ok(actionTypes.includes('ESCALATED_TO_CLINICAL'));
  assert.ok(actionTypes.includes('RESOLVED'));
});
