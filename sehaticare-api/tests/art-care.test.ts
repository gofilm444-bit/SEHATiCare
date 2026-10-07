import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-05: ART Care Plan, Adherence Tracking, Strict Scoping, Companion Privacy Wall & Patient Consent', async () => {
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

  // Region and Facility
  let region = await prisma.regions.findFirst();
  if (!region) {
    region = await prisma.regions.create({
      data: {
        id: randomUUID(),
        name: `Papua ART ${marker}`,
        code: `REG-ART-${marker}`,
        type: 'PROVINCE',
        updated_at: now
      }
    });
  }

  const facility = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Klinik ART Terpadu ${marker}`,
      facility_type: 'RUMAH_SAKIT',
      region_id: region.id,
      address: 'Jl. Terpadu No. 5',
      service_hours: '24 Jam',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  // Create Users
  await prisma.users.createMany({
    data: [
      { id: adminId, email: `admin-art-${marker}@test.local`, full_name: 'Admin Tata Kelola', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
      { id: patient1Id, email: `pat1-art-${marker}@test.local`, full_name: 'Pasien Satu ART', display_alias: 'Anggrek Biru', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: patient2Id, email: `pat2-art-${marker}@test.local`, full_name: 'Pasien Dua ART', display_alias: 'Mawar Merah', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: doctorAId, email: `docA-art-${marker}@test.local`, full_name: 'Dr. Dokter A ART', display_alias: 'Dr. A ART', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: doctorBId, email: `docB-art-${marker}@test.local`, full_name: 'Dr. Dokter B ART', display_alias: 'Dr. B ART', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: companion1Id, email: `comp1-art-${marker}@test.local`, full_name: 'Pendamping Sah', display_alias: 'Pendamping A', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
      { id: companion2Id, email: `comp2-art-${marker}@test.local`, full_name: 'Pendamping Asing', display_alias: 'Pendamping B', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now }
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

  // Legitimate Clinical Relationship: Doctor A has consultation with Patient 1
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

  // Active HIV Care Enrollments for Patient 1 & Patient 2
  const [enrollment1, enrollment2] = await Promise.all([
    prisma.hiv_care_enrollments.create({
      data: {
        id: randomUUID(),
        patient_user_id: patient1Id,
        facility_id: facility.id,
        status: 'ACTIVE',
        enrolled_at: now,
        created_by_user_id: adminId
      }
    }),
    prisma.hiv_care_enrollments.create({
      data: {
        id: randomUUID(),
        patient_user_id: patient2Id,
        facility_id: facility.id,
        status: 'ACTIVE',
        enrolled_at: now,
        created_by_user_id: adminId
      }
    })
  ]);

  // Seed sample medication occurrences for Patient 1 adherence calculation
  const sampleReminder = await prisma.medication_reminders.create({
    data: {
      id: randomUUID(),
      user_id: patient1Id,
      display_label: 'Pengingat Minum Obat Harian',
      medication_name: 'Tenofovir / Lamivudine / Dolutegravir',
      reveal_name_in_app: false,
      timezone: 'Asia/Jayapura',
      recurrence: 'DAILY',
      start_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      active_days: [0, 1, 2, 3, 4, 5, 6],
      is_active: true,
      notification_privacy: 'NEUTRAL',
      created_by: patient1Id,
      updated_at: now
    }
  });

  // Create 7 days of occurrences (6 TAKEN, 1 SKIPPED) within last 7 days
  for (let i = 1; i <= 7; i++) {
    const isSkipped = i === 3;
    await prisma.medication_occurrences.create({
      data: {
        id: randomUUID(),
        reminder_id: sampleReminder.id,
        user_id: patient1Id,
        scheduled_at: new Date(Date.now() - (i - 0.5) * 24 * 60 * 60 * 1000),
        responded_at: new Date(Date.now() - (i - 0.5) * 24 * 60 * 60 * 1000),
        status: isSkipped ? 'SKIPPED' : 'TAKEN',
        updated_at: now
      }
    });
  }

  // Next control schedule for Patient 1
  await prisma.control_schedules.create({
    data: {
      id: randomUUID(),
      user_id: patient1Id,
      worker_id: doctorAId,
      facility_id: facility.id,
      starts_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      timezone: 'Asia/Jayapura',
      control_type: 'KONTROL_RUTIN',
      status: 'SCHEDULED',
      source: 'HEALTH_WORKER',
      created_by: doctorAId,
      updated_by: doctorAId,
      updated_at: now
    }
  });

  // Resolve users
  const [adminUser, pat1User, pat2User, docAUser, docBUser, comp1User, comp2User] = await Promise.all([
    prisma.users.findUniqueOrThrow({ where: { id: adminId } }),
    prisma.users.findUniqueOrThrow({ where: { id: patient1Id } }),
    prisma.users.findUniqueOrThrow({ where: { id: patient2Id } }),
    prisma.users.findUniqueOrThrow({ where: { id: doctorAId } }),
    prisma.users.findUniqueOrThrow({ where: { id: doctorBId } }),
    prisma.users.findUniqueOrThrow({ where: { id: companion1Id } }),
    prisma.users.findUniqueOrThrow({ where: { id: companion2Id } })
  ]);

  let ipCounter = 1;
  const login = async (email: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      remoteAddress: `127.0.3.${ipCounter++}`,
      payload: { email, password: 'Secure-test-2026!' }
    });
    assert.equal(res.statusCode, 200);
    return res.json().access_token as string;
  };

  const adminToken = await login(adminUser.email!);
  const pat1Token = await login(pat1User.email!);
  const pat2Token = await login(pat2User.email!);
  const docAToken = await login(docAUser.email!);
  const docBToken = await login(docBUser.email!);
  const comp1Token = await login(comp1User.email!);
  const comp2Token = await login(comp2User.email!);

  let createdPlanPublicId = '';
  let createdItemId = '';

  // ==========================================
  // 1. DOCTOR CLINICAL SCOPING & CREATION
  // ==========================================

  // Doctor B (no relationship with Patient 1) cannot create ART care plan (Anti-IDOR)
  const docBUnrelatedRes = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${docBToken}` },
    payload: {
      items: [
        { medication_name: 'TLD Kombinasi', strength: '300/300/50 mg', dose_instructions: '1 tab per hari', frequency_per_day: 1 }
      ],
      clinical_notes: 'Catatan tidak sah'
    }
  });
  assert.equal(docBUnrelatedRes.statusCode, 403);

  // Doctor A (authorized) creates initial ART care plan for Patient 1
  const docACreateRes = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${docAToken}` },
    payload: {
      items: [
        { medication_name: 'Tenofovir + Lamivudine + Dolutegravir', strength: '300/300/50 mg', dose_instructions: '1 tablet malam hari sesudah makan', frequency_per_day: 1, timing_description: 'Malam' }
      ],
      clinical_notes: 'Mulai lini 1 ART. Monitor fungsi ginjal dan toleransi obat.'
    }
  });
  assert.equal(docACreateRes.statusCode, 201);
  const createdPlan = docACreateRes.json();
  assert.equal(createdPlan.status, 'ACTIVE');
  assert.equal(createdPlan.items.length, 1);
  assert.equal(createdPlan.items[0].medication_name, 'Tenofovir + Lamivudine + Dolutegravir');
  assert.ok(createdPlan.public_id.startsWith('art_'));
  createdPlanPublicId = createdPlan.public_id;
  createdItemId = createdPlan.items[0].id;

  // Doctor A checks ART care view for Patient 1
  const docAGetRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${docAToken}` }
  });
  assert.equal(docAGetRes.statusCode, 200);
  assert.equal(docAGetRes.json().active_plan.public_id, createdPlanPublicId);

  // Doctor B cannot read Patient 1 ART care plan
  const docBGetRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${docBToken}` }
  });
  assert.equal(docBGetRes.statusCode, 403);

  // Doctor updates regimen (prescribing new plan must preserve history)
  const docAReplaceRes = await app.inject({
    method: 'POST',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${docAToken}` },
    payload: {
      items: [
        { medication_name: 'TLD Terstandar FDC', strength: '300/300/50 mg', dose_instructions: '1 tab jam 20:00', frequency_per_day: 1 }
      ],
      clinical_notes: 'Penyesuaian instruksi minum obat tepat jam 20:00.',
      change_reason: 'Optimalisasi jam minum obat'
    }
  });
  assert.equal(docAReplaceRes.statusCode, 201);
  const secondPlan = docAReplaceRes.json();
  assert.equal(secondPlan.status, 'ACTIVE');
  assert.notEqual(secondPlan.public_id, createdPlanPublicId);

  // Verify previous plan was transitioned to MODIFIED and history is preserved
  const docAGetHistoryRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${docAToken}` }
  });
  assert.equal(docAGetHistoryRes.statusCode, 200);
  const historyData = docAGetHistoryRes.json();
  assert.equal(historyData.active_plan.public_id, secondPlan.public_id);
  assert.equal(historyData.history.length, 1);
  assert.equal(historyData.history[0].public_id, createdPlanPublicId);
  assert.equal(historyData.history[0].status, 'MODIFIED');
  assert.ok(historyData.history[0].ended_at);

  // ==========================================
  // 2. PATIENT OWN ART CARE VIEW & REMINDERS
  // ==========================================

  // Patient 1 views own active ART care plan
  const pat1GetRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care',
    headers: { authorization: `Bearer ${pat1Token}` }
  });
  assert.equal(pat1GetRes.statusCode, 200);
  const patPlan = pat1GetRes.json().plan;
  assert.equal(patPlan.public_id, secondPlan.public_id);
  assert.equal(patPlan.items[0].medication_name, 'TLD Terstandar FDC');
  assert.equal(pat1GetRes.headers['cache-control'], 'no-store, no-cache, must-revalidate, private');

  // Patient 1 views own history
  const pat1HistoryRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care/history',
    headers: { authorization: `Bearer ${pat1Token}` }
  });
  assert.equal(pat1HistoryRes.statusCode, 200);
  assert.equal(pat1HistoryRes.json().items.length, 1);
  assert.equal(pat1HistoryRes.json().items[0].public_id, createdPlanPublicId);

  // Patient 2 (who has no ART plan yet) sees null plan
  const pat2GetRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care',
    headers: { authorization: `Bearer ${pat2Token}` }
  });
  assert.equal(pat2GetRes.statusCode, 200);
  assert.equal(pat2GetRes.json().plan, null);

  // Patient 1 syncs/configures reminder from ART item
  const reminderSyncRes = await app.inject({
    method: 'POST',
    url: '/patient/art-care/reminders',
    headers: { authorization: `Bearer ${pat1Token}` },
    payload: {
      art_item_id: secondPlan.items[0].id,
      display_label: 'Pengingat Minum Obat Malam',
      reminder_times: ['20:00'],
      timezone: 'Asia/Jayapura',
      notification_privacy: 'NEUTRAL',
      is_active: true
    }
  });
  assert.equal(reminderSyncRes.statusCode, 201);
  assert.ok(reminderSyncRes.json().public_id.startsWith('med_'));

  // Patient 1 views adherence calculation
  const pat1AdherenceRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care/adherence?days=7',
    headers: { authorization: `Bearer ${pat1Token}` }
  });
  assert.equal(pat1AdherenceRes.statusCode, 200);
  const pat1Stats = pat1AdherenceRes.json().summary;
  assert.equal(pat1Stats.doses_taken, 6);
  assert.equal(pat1Stats.doses_missed, 1);
  assert.equal(pat1Stats.adherence_percentage, 85.7);
  assert.ok(pat1Stats.upcoming_control_schedule);

  // ==========================================
  // 3. PATIENT CONSENT ENGINE (DEFAULT OFF)
  // ==========================================

  // Check default consent is OFF
  const consentInitialRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care/support-consent',
    headers: { authorization: `Bearer ${pat1Token}` }
  });
  assert.equal(consentInitialRes.statusCode, 200);
  assert.equal(consentInitialRes.json().is_consent_enabled, false);

  // ==========================================
  // 4. COMPANION ACCESS & PRIVACY WALL
  // ==========================================

  // Test 4.1: Companion 1 (assigned) checks adherence support while consent is OFF
  // Result must be neutral, with NO summary and ZERO clinical details
  const comp1ConsentOffRes = await app.inject({
    method: 'GET',
    url: `/companion/patients/${pat1User.public_id}/adherence-support`,
    headers: { authorization: `Bearer ${comp1Token}` }
  });
  assert.equal(comp1ConsentOffRes.statusCode, 200);
  const comp1OffData = comp1ConsentOffRes.json();
  assert.equal(comp1OffData.support_consent_enabled, false);
  assert.equal(comp1OffData.summary, null);
  assert.match(comp1OffData.message, /belum mengaktifkan/i);

  // Test 4.2: Companion 2 (NOT assigned to Patient 1) is strictly DENIED (403)
  const comp2UnassignedRes = await app.inject({
    method: 'GET',
    url: `/companion/patients/${pat1User.public_id}/adherence-support`,
    headers: { authorization: `Bearer ${comp2Token}` }
  });
  assert.equal(comp2UnassignedRes.statusCode, 403);

  // Test 4.3: Companion cannot access Patient ART plan endpoint (403)
  const compArtPlanRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care',
    headers: { authorization: `Bearer ${comp1Token}` }
  });
  assert.equal(compArtPlanRes.statusCode, 403);

  // Test 4.4: Companion cannot access Doctor ART care endpoint (403)
  const compDocArtPlanRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${comp1Token}` }
  });
  assert.equal(compDocArtPlanRes.statusCode, 403);

  // ==========================================
  // 5. PATIENT ENABLES CONSENT & VERIFY PRIVACY PROJECTION
  // ==========================================

  // Patient 1 explicitly enables consent
  const enableConsentRes = await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/support-consent',
    headers: { authorization: `Bearer ${pat1Token}` },
    payload: { is_consent_enabled: true }
  });
  assert.equal(enableConsentRes.statusCode, 200);
  assert.equal(enableConsentRes.json().is_consent_enabled, true);

  // Companion 1 (assigned + consent ON) requests adherence support summary
  const comp1ConsentOnRes = await app.inject({
    method: 'GET',
    url: `/companion/patients/${pat1User.public_id}/adherence-support`,
    headers: { authorization: `Bearer ${comp1Token}` }
  });
  assert.equal(comp1ConsentOnRes.statusCode, 200);
  const compSummary = comp1ConsentOnRes.json();
  assert.equal(compSummary.support_consent_enabled, true);
  assert.ok(compSummary.summary);
  assert.equal(compSummary.summary.doses_taken, 6);
  assert.equal(compSummary.summary.doses_missed, 1);
  assert.equal(compSummary.summary.adherence_percentage, 85.7);

  // CRITICAL PRIVACY LEAKAGE AUDIT:
  // Companion response must NEVER contain medication_name, dose, strength, regimen, cd4, viral load, or notes
  const rawResponseString = JSON.stringify(compSummary).toLowerCase();
  assert.equal(rawResponseString.includes('tenofovir'), false, 'Leaked medication name Tenofovir');
  assert.equal(rawResponseString.includes('lamivudine'), false, 'Leaked medication name Lamivudine');
  assert.equal(rawResponseString.includes('dolutegravir'), false, 'Leaked medication name Dolutegravir');
  assert.equal(rawResponseString.includes('tld'), false, 'Leaked regimen TLD');
  assert.equal(rawResponseString.includes('300/300/50'), false, 'Leaked strength');
  assert.equal(rawResponseString.includes('clinical_notes'), false, 'Leaked clinical notes field');
  assert.equal(rawResponseString.includes('ginjal'), false, 'Leaked clinical note text');
  assert.equal(rawResponseString.includes('cd4'), false, 'Leaked CD4');
  assert.equal(rawResponseString.includes('viral_load'), false, 'Leaked Viral Load');

  // ==========================================
  // 6. PATIENT REVOKES CONSENT -> IMMEDIATE BLOCK
  // ==========================================

  // Patient 1 revokes consent
  const revokeConsentRes = await app.inject({
    method: 'PATCH',
    url: '/patient/art-care/support-consent',
    headers: { authorization: `Bearer ${pat1Token}` },
    payload: { is_consent_enabled: false }
  });
  assert.equal(revokeConsentRes.statusCode, 200);
  assert.equal(revokeConsentRes.json().is_consent_enabled, false);

  // Companion 1 immediately blocked from viewing summary again
  const comp1AfterRevokeRes = await app.inject({
    method: 'GET',
    url: `/companion/patients/${pat1User.public_id}/adherence-support`,
    headers: { authorization: `Bearer ${comp1Token}` }
  });
  assert.equal(comp1AfterRevokeRes.statusCode, 200);
  assert.equal(comp1AfterRevokeRes.json().support_consent_enabled, false);
  assert.equal(comp1AfterRevokeRes.json().summary, null);

  // ==========================================
  // 7. ADMIN PRIVACY WALL (NO CLINICAL ACCESS)
  // ==========================================

  // Admin cannot view Patient ART care plan (403)
  const adminPatientRes = await app.inject({
    method: 'GET',
    url: '/patient/art-care',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminPatientRes.statusCode, 403);

  // Admin cannot view Doctor ART care route (403)
  const adminDocRes = await app.inject({
    method: 'GET',
    url: `/doctor/patients/${pat1User.public_id}/art-care`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminDocRes.statusCode, 403);

  // Admin CAN view high-level governance metadata
  const adminGovRes = await app.inject({
    method: 'GET',
    url: '/admin/art-care-plans',
    headers: { authorization: `Bearer ${adminToken}` }
  });
  assert.equal(adminGovRes.statusCode, 200);
  const govData = adminGovRes.json();
  assert.ok(typeof govData.total_plans === 'number');
  assert.ok(typeof govData.active_plans === 'number');
  // Confirm NO clinical details in admin governance response
  assert.equal('items' in govData, false);
  assert.equal('medication_name' in govData, false);

  // ==========================================
  // 8. AUDIT LOG PRIVACY VERIFICATION
  // ==========================================

  // Verify audit logs were created
  const auditLogs = await prisma.audit_logs.findMany({
    where: {
      action: {
        in: [
          'ART_CARE_PLAN_CREATED',
          'COMPANION_SUPPORT_CONSENT_ENABLED',
          'COMPANION_SUPPORT_CONSENT_REVOKED',
          'COMPANION_ADHERENCE_SUMMARY_VIEWED'
        ]
      }
    },
    orderBy: { created_at: 'desc' },
    take: 10
  });
  assert.ok(auditLogs.length >= 3);

  // Verify audit metadata never contains raw medication names or clinical notes
  for (const log of auditLogs) {
    const metaStr = JSON.stringify(log.meta || {}).toLowerCase();
    assert.equal(metaStr.includes('tenofovir'), false, 'Audit meta contained Tenofovir');
    assert.equal(metaStr.includes('dolutegravir'), false, 'Audit meta contained Dolutegravir');
    assert.equal(metaStr.includes('ginjal'), false, 'Audit meta contained clinical text');
  }
});
