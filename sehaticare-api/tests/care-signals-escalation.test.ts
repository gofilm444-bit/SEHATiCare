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
  const dbSignal = await prisma.care_signals.findFirst({
    where: { source_type: 'SIDE_EFFECT', source_id: severeSeEntry.id }
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
