import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-04: HIV Care Enrollment, Clinical Monitoring, Strict Authorization, Companion & Admin Privacy Wall', async () => {
  const app = await buildApp();
  const marker = randomUUID().slice(0, 8);

  const adminId = randomUUID();
  const patient1Id = randomUUID();
  const patient2Id = randomUUID();
  const doctorAId = randomUUID();
  const doctorBId = randomUUID();
  const companionId = randomUUID();

  const passwordHash = await bcrypt.hash('Secure-test-2026!', 12);
  const now = new Date();

  // Find or create region and facilities
  let region = await prisma.regions.findFirst();
  if (!region) {
    region = await prisma.regions.create({
      data: {
        id: randomUUID(),
        name: `Papua Test ${marker}`,
        code: `REG-${marker}`,
        type: 'PROVINCE',
        updated_at: now
      }
    });
  }

  const facility1 = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `RSUD Jayapura ${marker}`,
      facility_type: 'RUMAH_SAKIT',
      region_id: region.id,
      address: 'Jl. Kesehatan No. 1',
      service_hours: '24 Jam',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  const facility2 = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Puskesmas Sentani ${marker}`,
      facility_type: 'PUSKESMAS',
      region_id: region.id,
      address: 'Jl. Kemiri No. 10',
      service_hours: '08:00 - 15:00',
      verification_status: 'VERIFIED',
      source_name: 'Dinkes',
      is_active: true,
      updated_at: now
    }
  });

  const inactiveFacility = await prisma.health_facilities.create({
    data: {
      id: randomUUID(),
      name: `Klinik Tutup ${marker}`,
      facility_type: 'KLINIK',
      region_id: region.id,
      address: 'Jl. Flamboyan',
      service_hours: 'Tutup',
      verification_status: 'UNVERIFIED',
      source_name: 'Dinkes',
      is_active: false,
      updated_at: now
    }
  });

  // Create Users
  await prisma.users.createMany({
    data: [
      { id: adminId, email: `admin-${marker}@test.local`, full_name: 'Admin Governance', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
      { id: patient1Id, email: `pat1-${marker}@test.local`, full_name: 'Pasien Satu', display_alias: 'Bunga Melati', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: patient2Id, email: `pat2-${marker}@test.local`, full_name: 'Pasien Dua', display_alias: 'Elang Laut', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
      { id: doctorAId, email: `docA-${marker}@test.local`, full_name: 'Dr. Dokter A', display_alias: 'Dr. A', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: doctorBId, email: `docB-${marker}@test.local`, full_name: 'Dr. Dokter B', display_alias: 'Dr. B', role: 'DOKTER', password_hash: passwordHash, updated_at: now },
      { id: companionId, email: `comp-${marker}@test.local`, full_name: 'Pendamping Maya', display_alias: 'Maya', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now }
    ]
  });

  // Doctor Profiles (Verified)
  await prisma.doctor_profiles.createMany({
    data: [
      { user_id: doctorAId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'RSUD Jayapura', str_number: 'STR-A-123', updated_at: now },
      { user_id: doctorBId, verification_status: 'VERIFIED', verified_at: now, puskesmas_name: 'RS Sentani', str_number: 'STR-B-456', updated_at: now }
    ]
  });

  // Companion Profile (Verified COMPANION)
  await prisma.counselor_profiles.create({
    data: {
      user_id: companionId,
      professional_name: 'Maya Pendamping',
      profession: 'Pendamping Sebaya',
      service_role: 'COMPANION',
      verification_status: 'VERIFIED',
      permission_enabled: true,
      is_active: true,
      verified_at: now,
      updated_at: now
    }
  });

  // Longitudinal assignment: Companion is assigned to Patient 1
  await prisma.patient_companion_assignments.create({
    data: {
      id: randomUUID(),
      patient_user_id: patient1Id,
      companion_user_id: companionId,
      facility_id: facility1.id,
      assigned_by_user_id: adminId,
      status: 'ACTIVE',
      started_at: now
    }
  });

  // Legitimate clinical relationship: Doctor A has a consultation with Patient 1
  const consultationId = randomUUID();
  await prisma.consultations.create({
    data: {
      id: consultationId,
      patient_id: patient1Id,
      assignedDoctorId: doctorAId,
      status: 'DOKTER_AKTIF',
      initial_complaint: 'Kontrol rutin',
      opened_at: now,
      doctor_joined_at: now,
      updated_at: now
    }
  });

  // Fetch created users to get their public_ids
  const [adminUser, pat1User, pat2User, docAUser, docBUser, compUser] = await Promise.all([
    prisma.users.findUniqueOrThrow({ where: { id: adminId } }),
    prisma.users.findUniqueOrThrow({ where: { id: patient1Id } }),
    prisma.users.findUniqueOrThrow({ where: { id: patient2Id } }),
    prisma.users.findUniqueOrThrow({ where: { id: doctorAId } }),
    prisma.users.findUniqueOrThrow({ where: { id: doctorBId } }),
    prisma.users.findUniqueOrThrow({ where: { id: companionId } })
  ]);

  let ipCounter = 1;
  const login = async (email: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      remoteAddress: `127.0.2.${ipCounter++}`,
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
  const compToken = await login(compUser.email!);

  try {
    // ========================================================
    // 1. ENROLLMENT LIFECYCLE & BUSINESS RULES
    // ========================================================

    // 1.1 Non-admin cannot create care enrollment
    const patCreateRes = await app.inject({
      method: 'POST',
      url: '/admin/care-enrollments',
      headers: { authorization: `Bearer ${pat1Token}` },
      payload: { patient_public_id: pat1User.public_id, facility_id: facility1.id }
    });
    assert.equal(patCreateRes.statusCode, 403, 'Patient cannot create enrollment');

    const docCreateRes = await app.inject({
      method: 'POST',
      url: '/admin/care-enrollments',
      headers: { authorization: `Bearer ${docAToken}` },
      payload: { patient_public_id: pat1User.public_id, facility_id: facility1.id }
    });
    assert.equal(docCreateRes.statusCode, 403, 'Doctor cannot create enrollment');

    // 1.2 Non-patient user cannot be enrolled
    const enrollDoctorRes = await app.inject({
      method: 'POST',
      url: '/admin/care-enrollments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_public_id: docAUser.public_id, facility_id: facility1.id }
    });
    assert.equal(enrollDoctorRes.statusCode, 400, 'Non-patient user cannot be enrolled');

    // 1.3 Inactive facility is rejected
    const inactiveFacilityRes = await app.inject({
      method: 'POST',
      url: '/admin/care-enrollments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_public_id: pat1User.public_id, facility_id: inactiveFacility.id }
    });
    assert.equal(inactiveFacilityRes.statusCode, 400, 'Inactive facility rejected');

    // 1.4 Admin creates ACTIVE care enrollment for Patient 1
    const createEnrollmentRes = await app.inject({
      method: 'POST',
      url: '/admin/care-enrollments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_public_id: pat1User.public_id, facility_id: facility1.id }
    });
    assert.equal(createEnrollmentRes.statusCode, 201, 'Admin can create enrollment for patient');
    const enrollment1 = createEnrollmentRes.json();
    assert.equal(enrollment1.status, 'ACTIVE');
    assert.equal(enrollment1.patient_public_id, pat1User.public_id);
    assert.equal(enrollment1.facility?.id, facility1.id);

    // 1.5 Duplicate ACTIVE enrollment for same patient rejected (409)
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/admin/care-enrollments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_public_id: pat1User.public_id, facility_id: facility2.id }
    });
    assert.equal(duplicateRes.statusCode, 409, 'Duplicate active enrollment must be rejected');

    // Also verify database partial unique index prevents two active enrollments
    await assert.rejects(
      async () => {
        await prisma.hiv_care_enrollments.create({
          data: {
            id: randomUUID(),
            patient_user_id: patient1Id,
            facility_id: facility2.id,
            status: 'ACTIVE',
            created_by_user_id: adminId
          }
        });
      },
      /unique constraint/i,
      'PostgreSQL partial unique index blocks second active enrollment'
    );

    // 1.6 Admin lists enrollments (metadata only, no clinical readings)
    const adminListRes = await app.inject({
      method: 'GET',
      url: '/admin/care-enrollments?status=ACTIVE',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminListRes.statusCode, 200);
    const adminList = adminListRes.json();
    assert.ok(adminList.items.length >= 1);
    const foundAdminItem = adminList.items.find((item: any) => item.public_id === enrollment1.public_id);
    assert.ok(foundAdminItem);
    assert.equal(foundAdminItem.status, 'ACTIVE');
    assert.equal(foundAdminItem.cd4_count_cells_mm3, undefined, 'Admin list has no clinical CD4');
    assert.equal(foundAdminItem.viral_load_copies_ml, undefined, 'Admin list has no clinical viral load');

    // 1.7 Transfer enrollment preserves history and creates new ACTIVE enrollment
    const transferRes = await app.inject({
      method: 'PUT',
      url: `/admin/care-enrollments/${enrollment1.public_id}/transfer`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { facility_id: facility2.id, transfer_reason: 'Pindah domisili ke Sentani' }
    });
    assert.equal(transferRes.statusCode, 200, 'Transfer enrollment succeeds');
    const newEnrollment = transferRes.json();
    assert.equal(newEnrollment.status, 'ACTIVE');
    assert.equal(newEnrollment.facility?.id, facility2.id);

    // Verify old enrollment is preserved with status TRANSFERRED
    const oldEnrollmentInDb = await prisma.hiv_care_enrollments.findUnique({
      where: { public_id: enrollment1.public_id }
    });
    assert.equal(oldEnrollmentInDb?.status, 'TRANSFERRED');
    assert.ok(oldEnrollmentInDb?.ended_at);
    assert.equal(oldEnrollmentInDb?.end_reason, 'Pindah domisili ke Sentani');

    // Also enroll Patient 2 for subsequent doctor cross-patient tests
    const createPat2EnrollmentRes = await app.inject({
      method: 'POST',
      url: '/admin/care-enrollments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_public_id: pat2User.public_id, facility_id: facility1.id }
    });
    assert.equal(createPat2EnrollmentRes.statusCode, 201);

    // ========================================================
    // 2. DOCTOR AUTHORIZATION & CLINICAL MONITORING
    // ========================================================

    // 2.1 Doctor A (has legitimate relationship with Patient 1) views Patient 1 care
    const docACareRes = await app.inject({
      method: 'GET',
      url: `/doctor/patients/${pat1User.public_id}/care`,
      headers: { authorization: `Bearer ${docAToken}` }
    });
    assert.equal(docACareRes.statusCode, 200, 'Doctor A can view care of assigned Patient 1');
    assert.equal(docACareRes.json().care?.status, 'ACTIVE');

    // 2.2 Doctor B (NO relationship with Patient 1) views Patient 1 care -> 403 Forbidden
    const docBCareRes = await app.inject({
      method: 'GET',
      url: `/doctor/patients/${pat1User.public_id}/care`,
      headers: { authorization: `Bearer ${docBToken}` }
    });
    assert.equal(docBCareRes.statusCode, 403, 'Doctor B without relationship cannot view care of Patient 1');

    // 2.3 Doctor B cannot view Patient 1 monitoring entries -> 403 Forbidden
    const docBMonListRes = await app.inject({
      method: 'GET',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docBToken}` }
    });
    assert.equal(docBMonListRes.statusCode, 403, 'Doctor B without relationship cannot view monitoring');

    // 2.4 Doctor B cannot create monitoring for Patient 1 -> 403 Forbidden
    const docBCreateMonRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docBToken}` },
      payload: {
        recorded_at: new Date().toISOString(),
        cd4_count_cells_mm3: 500,
        viral_load_copies_ml: 0,
        weight_kg: 62.5
      }
    });
    assert.equal(docBCreateMonRes.statusCode, 403, 'Doctor B cannot create monitoring entry');

    // 2.5 Doctor A cannot access Patient 2 (without relationship) -> 403 Forbidden
    const docAPat2Res = await app.inject({
      method: 'GET',
      url: `/doctor/patients/${pat2User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` }
    });
    assert.equal(docAPat2Res.statusCode, 403, 'Doctor A cannot access Patient 2 without relationship');

    // 2.6 Doctor A creates clinical monitoring for Patient 1
    const createMonRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        recorded_at: new Date().toISOString(),
        weight_kg: 65.5,
        cd4_count_cells_mm3: 450,
        viral_load_copies_ml: 50,
        viral_load_interpretation: 'DETECTED',
        tb_screening_result: 'NEGATIF',
        general_condition: 'Kondisi umum baik, tidak ada keluhan nafsu makan',
        clinical_note_private: 'Catatan dokter rahasia: kepatuhan minum obat terpantau konsisten'
      }
    });
    assert.equal(createMonRes.statusCode, 201, 'Doctor A creates clinical entry');
    const doctorEntry = createMonRes.json();
    assert.equal(doctorEntry.source, 'DOCTOR');
    assert.equal(doctorEntry.weight_kg, 65.5);
    assert.equal(doctorEntry.cd4_count_cells_mm3, 450);
    assert.equal(doctorEntry.viral_load_copies_ml, 50);
    assert.equal(doctorEntry.viral_load_interpretation, 'DETECTED');
    assert.equal(doctorEntry.tb_screening_result, 'NEGATIF');
    assert.equal(doctorEntry.clinical_note_private, 'Catatan dokter rahasia: kepatuhan minum obat terpantau konsisten');

    // 2.7 Doctor A updates clinical monitoring entry
    const updateMonRes = await app.inject({
      method: 'PUT',
      url: `/doctor/monitoring/${doctorEntry.public_id}`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        weight_kg: 66.0,
        general_condition: 'Kondisi umum stabil dan berat badan naik 0.5 kg'
      }
    });
    assert.equal(updateMonRes.statusCode, 200, 'Doctor A can update monitoring entry');
    assert.equal(updateMonRes.json().weight_kg, 66.0);

    // 2.8 Doctor B cannot update Doctor A's monitoring entry
    const docBUpdateRes = await app.inject({
      method: 'PUT',
      url: `/doctor/monitoring/${doctorEntry.public_id}`,
      headers: { authorization: `Bearer ${docBToken}` },
      payload: { weight_kg: 70 }
    });
    assert.equal(docBUpdateRes.statusCode, 403, 'Doctor B cannot update Patient 1 entry');

    // ========================================================
    // 3. PATIENT PRIVACY & SELF-REPORT
    // ========================================================

    // 3.1 Patient 1 views own care
    const pat1CareRes = await app.inject({
      method: 'GET',
      url: '/patient/care',
      headers: { authorization: `Bearer ${pat1Token}` }
    });
    assert.equal(pat1CareRes.statusCode, 200);
    assert.equal(pat1CareRes.json().care?.status, 'ACTIVE');

    // 3.2 Patient 1 views own monitoring entries: PRIVATE NOTE IS NEVER SENT!
    const pat1MonRes = await app.inject({
      method: 'GET',
      url: '/patient/monitoring',
      headers: { authorization: `Bearer ${pat1Token}` }
    });
    assert.equal(pat1MonRes.statusCode, 200);
    const pat1Items = pat1MonRes.json().items;
    assert.ok(pat1Items.length >= 1);
    const patVisibleDocEntry = pat1Items.find((e: any) => e.public_id === doctorEntry.public_id);
    assert.ok(patVisibleDocEntry);
    assert.equal(patVisibleDocEntry.clinical_note_private, undefined, 'Patient presenter must omit clinical_note_private');
    assert.equal(patVisibleDocEntry.cd4_count_cells_mm3, 450);
    assert.equal(patVisibleDocEntry.viral_load_copies_ml, 50);

    // 3.3 Patient 1 creates safe SELF_REPORT
    const patSelfReportRes = await app.inject({
      method: 'POST',
      url: '/patient/monitoring',
      headers: { authorization: `Bearer ${pat1Token}` },
      payload: {
        recorded_at: new Date().toISOString(),
        weight_kg: 66.2,
        general_condition: 'Merasa sehat dan segar',
        patient_note: 'Minum obat teratur jam 20:00'
      }
    });
    assert.equal(patSelfReportRes.statusCode, 201);
    const selfReport = patSelfReportRes.json();
    assert.equal(selfReport.source, 'PATIENT', 'Server enforces source = PATIENT');
    assert.equal(selfReport.is_self_report, true);
    assert.equal(selfReport.weight_kg, 66.2);
    assert.equal(selfReport.patient_note, 'Minum obat teratur jam 20:00');

    // 3.4 Patient cannot spoof source = DOCTOR or send CD4
    const spoofRes = await app.inject({
      method: 'POST',
      url: '/patient/monitoring',
      headers: { authorization: `Bearer ${pat1Token}` },
      payload: {
        recorded_at: new Date().toISOString(),
        source: 'DOCTOR',
        cd4_count_cells_mm3: 999,
        clinical_note_private: 'Hacked note'
      }
    });
    // Extra fields are ignored or stripped by schema, source is ALWAYS PATIENT
    if (spoofRes.statusCode === 201) {
      assert.equal(spoofRes.json().source, 'PATIENT');
      assert.equal(spoofRes.json().cd4_count_cells_mm3, null);
    }

    // ========================================================
    // 4. COMPANION (PENDAMPING) PRIVACY WALL
    // ========================================================

    // 4.1 Companion cannot view Doctor care summary
    const compCareRes = await app.inject({
      method: 'GET',
      url: `/doctor/patients/${pat1User.public_id}/care`,
      headers: { authorization: `Bearer ${compToken}` }
    });
    assert.equal(compCareRes.statusCode, 403, 'Companion blocked from doctor care endpoint');

    // 4.2 Companion cannot view Clinical Monitoring
    const compMonRes = await app.inject({
      method: 'GET',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${compToken}` }
    });
    assert.equal(compMonRes.statusCode, 403, 'Companion blocked from doctor monitoring endpoint');

    // 4.3 Companion cannot create Clinical Monitoring
    const compCreateMonRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${compToken}` },
      payload: { recorded_at: new Date().toISOString(), cd4_count_cells_mm3: 500 }
    });
    assert.equal(compCreateMonRes.statusCode, 403, 'Companion blocked from creating clinical monitoring');

    // 4.4 Companion cannot access Patient self monitoring endpoint
    const compPatientMonRes = await app.inject({
      method: 'GET',
      url: '/patient/monitoring',
      headers: { authorization: `Bearer ${compToken}` }
    });
    assert.equal(compPatientMonRes.statusCode, 403, 'Companion blocked from patient self monitoring');

    // ========================================================
    // 5. ADMIN PRIVACY WALL
    // ========================================================

    // 5.1 Admin cannot read clinical monitoring from doctor endpoint
    const adminDocMonRes = await app.inject({
      method: 'GET',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminDocMonRes.statusCode, 403, 'Admin cannot bypass into doctor monitoring endpoint');

    // 5.2 Admin cannot read patient monitoring endpoint
    const adminPatMonRes = await app.inject({
      method: 'GET',
      url: '/patient/monitoring',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminPatMonRes.statusCode, 403, 'Admin cannot call patient monitoring endpoint');

    // ========================================================
    // 6. VALIDATION & TECHNICAL CONSTRAINTS
    // ========================================================

    // 6.1 Negative CD4 rejected
    const negCd4Res = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        recorded_at: new Date().toISOString(),
        cd4_count_cells_mm3: -10
      }
    });
    assert.equal(negCd4Res.statusCode, 400, 'Negative CD4 count rejected');

    // 6.2 Negative Viral Load rejected
    const negVlRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        recorded_at: new Date().toISOString(),
        viral_load_copies_ml: -5
      }
    });
    assert.equal(negVlRes.statusCode, 400, 'Negative viral load rejected');

    // 6.3 Negative Weight rejected
    const negWeightRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        recorded_at: new Date().toISOString(),
        weight_kg: -45
      }
    });
    assert.equal(negWeightRes.statusCode, 400, 'Negative weight rejected');

    // 6.4 Malformed date rejected
    const badDateRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        recorded_at: 'not-a-valid-date'
      }
    });
    assert.equal(badDateRes.statusCode, 400, 'Malformed date rejected');

    // 6.5 Invalid viral load interpretation enum rejected
    const badEnumRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        recorded_at: new Date().toISOString(),
        viral_load_interpretation: 'SUPER_VIRUS'
      }
    });
    assert.equal(badEnumRes.statusCode, 400, 'Invalid viral load interpretation rejected');

    // 6.6 Oversized private note rejected
    const bigNoteRes = await app.inject({
      method: 'POST',
      url: `/doctor/patients/${pat1User.public_id}/monitoring`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: {
        recorded_at: new Date().toISOString(),
        clinical_note_private: 'A'.repeat(2500)
      }
    });
    assert.equal(bigNoteRes.statusCode, 400, 'Oversized clinical note rejected');

    // ========================================================
    // 7. ARCHIVING CLINICAL ENTRY
    // ========================================================

    const archiveRes = await app.inject({
      method: 'POST',
      url: `/doctor/monitoring/${doctorEntry.public_id}/archive`,
      headers: { authorization: `Bearer ${docAToken}` }
    });
    assert.equal(archiveRes.statusCode, 200, 'Doctor A can archive clinical entry');
    assert.ok(archiveRes.json().archived_at);

    // Patient cannot see archived entry in their list
    const patMonAfterArchive = await app.inject({
      method: 'GET',
      url: '/patient/monitoring',
      headers: { authorization: `Bearer ${pat1Token}` }
    });
    const remainingPatItems = patMonAfterArchive.json().items;
    const archivedFound = remainingPatItems.find((e: any) => e.public_id === doctorEntry.public_id);
    assert.equal(archivedFound, undefined, 'Archived entry is hidden from patient view');

    // Modifying archived entry rejected
    const editArchivedRes = await app.inject({
      method: 'PUT',
      url: `/doctor/monitoring/${doctorEntry.public_id}`,
      headers: { authorization: `Bearer ${docAToken}` },
      payload: { weight_kg: 68 }
    });
    assert.equal(editArchivedRes.statusCode, 400, 'Cannot edit archived entry');

    // ========================================================
    // 8. CACHE-CONTROL HEADERS
    // ========================================================

    assert.equal(pat1CareRes.headers['cache-control'], 'no-store, no-cache, must-revalidate, private');
    assert.equal(pat1MonRes.headers['cache-control'], 'no-store, no-cache, must-revalidate, private');
    assert.equal(docACareRes.headers['cache-control'], 'no-store, no-cache, must-revalidate, private');

    // ========================================================
    // 9. SENSITIVE ACCESS AUDITS SAFETY
    // ========================================================

    const sensitiveAudits = await prisma.sensitive_access_audits.findMany({
      where: {
        resource_type: { in: ['CARE_ENROLLMENT', 'HIV_MONITORING'] },
        actor_user_id: { in: [adminId, doctorAId, patient1Id] }
      }
    });
    assert.ok(sensitiveAudits.length > 0, 'Sensitive access audits were generated');

    // Verify safe_metadata contains NO actual CD4, viral load, or clinical notes
    for (const audit of sensitiveAudits) {
      if (audit.safe_metadata) {
        const metaStr = JSON.stringify(audit.safe_metadata);
        assert.ok(!metaStr.includes('Catatan dokter rahasia'), 'Audit must not leak private doctor note');
        assert.ok(!metaStr.includes('450'), 'Audit must not leak CD4 count');
        assert.ok(!metaStr.includes('NEGATIF'), 'Audit must not leak TB screening result');
      }
    }
  } finally {
    // Cleanup created test records
    await prisma.sensitive_access_audits.deleteMany({
      where: { actor_user_id: { in: [adminId, doctorAId, doctorBId, patient1Id, patient2Id, companionId] } }
    });
    await prisma.audit_logs.deleteMany({
      where: { actor_user_id: { in: [adminId, doctorAId, doctorBId, patient1Id, patient2Id, companionId] } }
    });
    await prisma.hiv_monitoring_entries.deleteMany({
      where: { patient_user_id: { in: [patient1Id, patient2Id] } }
    });
    await prisma.hiv_care_enrollments.deleteMany({
      where: { patient_user_id: { in: [patient1Id, patient2Id] } }
    });
    await prisma.patient_companion_assignments.deleteMany({
      where: { patient_user_id: { in: [patient1Id, patient2Id] } }
    });
    await prisma.consultations.deleteMany({
      where: { id: consultationId }
    });
    await prisma.counselor_profiles.deleteMany({
      where: { user_id: companionId }
    });
    await prisma.doctor_profiles.deleteMany({
      where: { user_id: { in: [doctorAId, doctorBId] } }
    });
    await prisma.refresh_tokens.deleteMany({
      where: { user_id: { in: [adminId, patient1Id, patient2Id, doctorAId, doctorBId, companionId] } }
    });
    await prisma.users.deleteMany({
      where: { id: { in: [adminId, patient1Id, patient2Id, doctorAId, doctorBId, companionId] } }
    });
    await prisma.health_facilities.deleteMany({
      where: { id: { in: [facility1.id, facility2.id, inactiveFacility.id] } }
    });
  }
});
