import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('longitudinal patient-companion assignments: business rules, atomic reassignment, IDOR scoping, and audit logging', async () => {
  const app = await buildApp();
  const marker = randomUUID();

  const adminId = randomUUID();
  const patient1Id = randomUUID();
  const patient2Id = randomUUID();
  const companion1Id = randomUUID();
  const companion2Id = randomUUID();
  const unverifiedCompanionId = randomUUID();
  const regularCounselorId = randomUUID();
  const inactiveCompanionId = randomUUID();
  const nonPatientDoctorId = randomUUID();

  const passwordHash = await bcrypt.hash('Secure-test-2026!', 12);
  const now = new Date();

  const userIds = [
    adminId,
    patient1Id,
    patient2Id,
    companion1Id,
    companion2Id,
    unverifiedCompanionId,
    regularCounselorId,
    inactiveCompanionId,
    nonPatientDoctorId
  ];

  try {
    // 1. Create all test users
    await prisma.users.createMany({
      data: [
        { id: adminId, email: `admin-${marker}@test.local`, full_name: 'Admin Governance', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
        { id: patient1Id, email: `pat1-${marker}@test.local`, full_name: 'Pasien Satu', display_alias: 'Bunga Melati', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
        { id: patient2Id, email: `pat2-${marker}@test.local`, full_name: 'Pasien Dua', display_alias: 'Elang Laut', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
        { id: companion1Id, email: `comp1-${marker}@test.local`, full_name: 'Pendamping Utama A', display_alias: 'Pendamping Maya', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: companion2Id, email: `comp2-${marker}@test.local`, full_name: 'Pendamping Utama B', display_alias: 'Pendamping Budi', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: unverifiedCompanionId, email: `unver-${marker}@test.local`, full_name: 'Pendamping Pending', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: regularCounselorId, email: `counselor-${marker}@test.local`, full_name: 'Konselor Medis', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: inactiveCompanionId, email: `inact-${marker}@test.local`, full_name: 'Pendamping Nonaktif', role: 'COUNSELOR', password_hash: passwordHash, is_active: false, updated_at: now },
        { id: nonPatientDoctorId, email: `doc-${marker}@test.local`, full_name: 'Dokter Spesialis', role: 'DOKTER', password_hash: passwordHash, updated_at: now }
      ]
    });

    // 2. Create counselor profiles
    await prisma.counselor_profiles.createMany({
      data: [
        {
          user_id: companion1Id,
          professional_name: 'Maya Pendamping',
          profession: 'Pendamping Sebaya',
          service_role: 'COMPANION',
          verification_status: 'VERIFIED',
          permission_enabled: true,
          is_active: true,
          verified_at: now,
          updated_at: now
        },
        {
          user_id: companion2Id,
          professional_name: 'Budi Pendamping',
          profession: 'Pendamping Sebaya',
          service_role: 'COMPANION',
          verification_status: 'VERIFIED',
          permission_enabled: true,
          is_active: true,
          verified_at: now,
          updated_at: now
        },
        {
          user_id: unverifiedCompanionId,
          professional_name: 'Deni Belum Terverifikasi',
          profession: 'Pendamping',
          service_role: 'COMPANION',
          verification_status: 'PENDING',
          permission_enabled: false,
          is_active: true,
          verified_at: null,
          updated_at: now
        },
        {
          user_id: regularCounselorId,
          professional_name: 'Siti Konselor',
          profession: 'Konselor VCT',
          service_role: 'COUNSELOR',
          verification_status: 'VERIFIED',
          permission_enabled: true,
          is_active: true,
          verified_at: now,
          updated_at: now
        },
        {
          user_id: inactiveCompanionId,
          professional_name: 'Toni Nonaktif',
          profession: 'Pendamping',
          service_role: 'COMPANION',
          verification_status: 'VERIFIED',
          permission_enabled: true,
          is_active: false,
          verified_at: now,
          updated_at: now
        }
      ]
    });

    // Helper login
    const login = async (email: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'Secure-test-2026!' }
      });
      assert.equal(res.statusCode, 200);
      return res.json().access_token as string;
    };

    const adminToken = await login(`admin-${marker}@test.local`);
    const patient1Token = await login(`pat1-${marker}@test.local`);
    const patient2Token = await login(`pat2-${marker}@test.local`);
    const companion1Token = await login(`comp1-${marker}@test.local`);
    const companion2Token = await login(`comp2-${marker}@test.local`);

    // ========================================================
    // TEST 1: Non-admin cannot create or modify assignments (RBAC)
    // ========================================================
    const unauthPost = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      payload: { patient_id: patient1Id, companion_id: companion1Id }
    });
    assert.equal(unauthPost.statusCode, 401);

    const companionForbiddenPost = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${companion1Token}` },
      payload: { patient_id: patient1Id, companion_id: companion1Id }
    });
    assert.equal(companionForbiddenPost.statusCode, 403);

    const patientForbiddenPost = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${patient1Token}` },
      payload: { patient_id: patient1Id, companion_id: companion1Id }
    });
    assert.equal(patientForbiddenPost.statusCode, 403);

    // ========================================================
    // TEST 2: Business rule validation
    // ========================================================
    // A. User bukan PASIEN tidak dapat dijadikan target assignment
    const assignNonPatient = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_id: nonPatientDoctorId, companion_id: companion1Id }
    });
    assert.equal(assignNonPatient.statusCode, 400);
    assert.match(assignNonPatient.json().message, /bukan pasien/i);

    // B. User COUNSELOR dengan service_role selain COMPANION tidak dapat dijadikan pendamping
    const assignRegularCounselor = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_id: patient1Id, companion_id: regularCounselorId }
    });
    assert.equal(assignRegularCounselor.statusCode, 400);
    assert.match(assignRegularCounselor.json().message, /peran COMPANION/i);

    // C. COMPANION belum VERIFIED tidak dapat menerima assignment
    const assignUnverified = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_id: patient1Id, companion_id: unverifiedCompanionId }
    });
    assert.equal(assignUnverified.statusCode, 400);
    assert.match(assignUnverified.json().message, /terverifikasi/i);

    // D. Inactive companion tidak dapat menerima assignment
    const assignInactive = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_id: patient1Id, companion_id: inactiveCompanionId }
    });
    assert.equal(assignInactive.statusCode, 400);

    // ========================================================
    // TEST 3: Admin successfully assigns verified COMPANION to patient 1
    // ========================================================
    const createRes1 = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        patient_id: patient1Id,
        companion_id: companion1Id,
        notes: 'Pendampingan awal wilayah Ternate'
      }
    });
    assert.equal(createRes1.statusCode, 201);
    const assignment1 = createRes1.json();
    assert.equal(assignment1.status, 'ACTIVE');
    assert.equal(assignment1.companion.professional_name, 'Maya Pendamping');
    assert.equal(assignment1.companion.service_role, 'COMPANION');
    assert.equal(assignment1.patient.display_alias, 'Bunga Melati');

    // Also assign Companion 2 to Patient 2 for IDOR verification
    const createRes2 = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        patient_id: patient2Id,
        companion_id: companion2Id,
        notes: 'Pendampingan kepatuhan minum obat'
      }
    });
    assert.equal(createRes2.statusCode, 201);
    const assignment2 = createRes2.json();
    assert.equal(assignment2.status, 'ACTIVE');

    // ========================================================
    // TEST 4: Partial unique index prevents duplicate ACTIVE assignments
    // ========================================================
    // When attempting to raw-insert a second ACTIVE assignment directly in DB, PostgreSQL throws unique violation!
    await assert.rejects(
      async () => {
        await prisma.patient_companion_assignments.create({
          data: {
            id: randomUUID(),
            patient_user_id: patient1Id,
            companion_user_id: companion2Id,
            assigned_by_user_id: adminId,
            status: 'ACTIVE',
            started_at: now
          }
        });
      },
      (err: any) => {
        // Must fail with PostgreSQL unique constraint error
        return String(err).includes('patient_companion_assignments_one_active_idx') ||
               String(err).includes('Unique constraint failed');
      }
    );

    // ========================================================
    // TEST 5: Atomic Reassignment (Old ENDED, New ACTIVE in single transaction)
    // ========================================================
    const reassignRes = await app.inject({
      method: 'PUT',
      url: `/admin/companion-assignments/${assignment1.id}/reassign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        companion_id: companion2Id,
        reason: 'Rotasi wilayah penugasan pendamping',
        notes: 'Dialihkan ke Pendamping Budi'
      }
    });
    assert.equal(reassignRes.statusCode, 200);
    const newAssignment1 = reassignRes.json();
    assert.equal(newAssignment1.status, 'ACTIVE');
    assert.equal(newAssignment1.companion.id, companion2Id);
    assert.notEqual(newAssignment1.id, assignment1.id);

    // Verify old assignment is ENDED with ended_at and reason preserved
    const oldAssignmentCheck = await prisma.patient_companion_assignments.findUnique({
      where: { id: assignment1.id }
    });
    assert.equal(oldAssignmentCheck?.status, 'ENDED');
    assert.ok(oldAssignmentCheck?.ended_at);
    assert.equal(oldAssignmentCheck?.end_reason, 'Rotasi wilayah penugasan pendamping');

    // ========================================================
    // TEST 6: Ending an assignment preserves history
    // ========================================================
    const endRes = await app.inject({
      method: 'PUT',
      url: `/admin/companion-assignments/${newAssignment1.id}/end`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Pasien telah menyelesaikan program pendampingan mandiri' }
    });
    assert.equal(endRes.statusCode, 200);
    const endedData = endRes.json();
    assert.equal(endedData.status, 'ENDED');
    assert.equal(endedData.end_reason, 'Pasien telah menyelesaikan program pendampingan mandiri');

    // Ensure reassign on already ENDED assignment is rejected
    const reassignEnded = await app.inject({
      method: 'PUT',
      url: `/admin/companion-assignments/${newAssignment1.id}/reassign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { companion_id: companion1Id }
    });
    assert.equal(reassignEnded.statusCode, 400);

    // Restore active assignment for Patient 1 -> Companion 1 for IDOR tests
    const restoreRes = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_id: patient1Id, companion_id: companion1Id }
    });
    assert.equal(restoreRes.statusCode, 201);
    const activeAssign1 = restoreRes.json();

    // ========================================================
    // TEST 7: IDOR & Scoping tests (Companion Roster)
    // ========================================================
    // Companion 1 has Patient 1 assigned.
    // Companion 2 has Patient 2 assigned.

    // A. Companion 1 roster includes Patient 1 only
    const comp1Roster = await app.inject({
      method: 'GET',
      url: '/companion/patients',
      headers: { authorization: `Bearer ${companion1Token}` }
    });
    assert.equal(comp1Roster.statusCode, 200);
    const comp1Patients = comp1Roster.json().items;
    assert.ok(comp1Patients.some((p: any) => p.display_alias === 'Bunga Melati'));
    assert.ok(!comp1Patients.some((p: any) => p.display_alias === 'Elang Laut'));

    // B. Companion 2 roster includes Patient 2 only
    const comp2Roster = await app.inject({
      method: 'GET',
      url: '/companion/patients',
      headers: { authorization: `Bearer ${companion2Token}` }
    });
    assert.equal(comp2Roster.statusCode, 200);
    const comp2Patients = comp2Roster.json().items;
    assert.ok(comp2Patients.some((p: any) => p.display_alias === 'Elang Laut'));
    assert.ok(!comp2Patients.some((p: any) => p.display_alias === 'Bunga Melati'));

    // C. IDOR Single Item: Companion 1 CAN view Patient 1 detail
    const comp1ViewPat1 = await app.inject({
      method: 'GET',
      url: `/companion/patients/${activeAssign1.patient.public_id}`,
      headers: { authorization: `Bearer ${companion1Token}` }
    });
    assert.equal(comp1ViewPat1.statusCode, 200);
    assert.equal(comp1ViewPat1.json().display_alias, 'Bunga Melati');

    // D. IDOR Single Item: Companion 1 CANNOT view Patient 2 detail (403 Forbidden!)
    const comp1ViewPat2 = await app.inject({
      method: 'GET',
      url: `/companion/patients/${assignment2.patient.public_id}`,
      headers: { authorization: `Bearer ${companion1Token}` }
    });
    assert.equal(comp1ViewPat2.statusCode, 403);

    // E. IDOR Single Item: Companion 2 CANNOT view Patient 1 detail (403 Forbidden!)
    const comp2ViewPat1 = await app.inject({
      method: 'GET',
      url: `/companion/patients/${activeAssign1.patient.public_id}`,
      headers: { authorization: `Bearer ${companion2Token}` }
    });
    assert.equal(comp2ViewPat1.statusCode, 403);

    // F. Non-companion (patient) CANNOT access companion roster
    const patientAccessRoster = await app.inject({
      method: 'GET',
      url: '/companion/patients',
      headers: { authorization: `Bearer ${patient1Token}` }
    });
    assert.equal(patientAccessRoster.statusCode, 403);

    // ========================================================
    // TEST 8: Patient companion view (Self-scoping)
    // ========================================================
    // Patient 1 sees Companion 1
    const pat1CompanionView = await app.inject({
      method: 'GET',
      url: '/patient/companion',
      headers: { authorization: `Bearer ${patient1Token}` }
    });
    assert.equal(pat1CompanionView.statusCode, 200);
    assert.equal(pat1CompanionView.json().assigned, true);
    assert.equal(pat1CompanionView.json().companion.professional_name, 'Maya Pendamping');
    assert.equal(pat1CompanionView.json().companion.service_role, 'COMPANION');

    // Patient 2 sees Companion 2
    const pat2CompanionView = await app.inject({
      method: 'GET',
      url: '/patient/companion',
      headers: { authorization: `Bearer ${patient2Token}` }
    });
    assert.equal(pat2CompanionView.statusCode, 200);
    assert.equal(pat2CompanionView.json().assigned, true);
    assert.equal(pat2CompanionView.json().companion.professional_name, 'Budi Pendamping');

    // When Patient 2 assignment is ended, patient view returns clean unassigned state (200, not 500)
    await app.inject({
      method: 'PUT',
      url: `/admin/companion-assignments/${assignment2.id}/end`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Selesai pendampingan' }
    });

    const pat2UnassignedView = await app.inject({
      method: 'GET',
      url: '/patient/companion',
      headers: { authorization: `Bearer ${patient2Token}` }
    });
    assert.equal(pat2UnassignedView.statusCode, 200);
    assert.equal(pat2UnassignedView.json().assigned, false);
    assert.equal(pat2UnassignedView.json().companion, null);

    // ========================================================
    // TEST 9: Audit log verification
    // ========================================================
    const auditLogs = await prisma.audit_logs.findMany({
      where: {
        entity_type: 'patient_companion_assignment',
        actor_user_id: adminId
      }
    });
    const actions = auditLogs.map((l) => l.action);
    assert.ok(actions.includes('COMPANION_ASSIGNMENT_CREATE'));
    assert.ok(actions.includes('COMPANION_ASSIGNMENT_REASSIGN'));
    assert.ok(actions.includes('COMPANION_ASSIGNMENT_END'));

    // Verify sensitive access audits logged when companion accessed assigned patient
    const accessAudits = await prisma.sensitive_access_audits.findMany({
      where: {
        actor_user_id: companion1Id,
        resource_type: 'companion_patient_roster'
      }
    });
    assert.ok(accessAudits.length >= 1);
    assert.equal(accessAudits[0].action, 'VIEW_ASSIGNED_PATIENT');

    // ========================================================
    // TEST 10: Data minimization & Privacy check
    // ========================================================
    // Verify roster response never leaks sensitive PII
    const rawRosterJson = JSON.stringify(comp1Roster.json());
    assert.ok(!rawRosterJson.includes('email'));
    assert.ok(!rawRosterJson.includes('phone'));
    assert.ok(!rawRosterJson.includes('password'));
    assert.ok(!rawRosterJson.includes('recovery'));
    assert.ok(!rawRosterJson.includes('status_hiv'));

    // Admin candidates endpoint check
    const candidatesRes = await app.inject({
      method: 'GET',
      url: '/admin/companion-assignments/candidates',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(candidatesRes.statusCode, 200);
    const candidates = candidatesRes.json();
    assert.ok(Array.isArray(candidates.patients));
    assert.ok(Array.isArray(candidates.companions));
    assert.ok(candidates.companions.some((c: any) => c.professional_name === 'Maya Pendamping'));
  } finally {
    // Cleanup created assignments and users in reverse order
    await prisma.sensitive_access_audits.deleteMany({
      where: { actor_user_id: { in: userIds } }
    });
    await prisma.patient_companion_assignments.deleteMany({
      where: {
        OR: [
          { patient_user_id: { in: userIds } },
          { companion_user_id: { in: userIds } },
          { assigned_by_user_id: { in: userIds } }
        ]
      }
    });
    await prisma.counselor_profiles.deleteMany({
      where: { user_id: { in: userIds } }
    });
    await prisma.audit_logs.deleteMany({
      where: { actor_user_id: { in: userIds } }
    });
    await prisma.refresh_tokens.deleteMany({
      where: { user_id: { in: userIds } }
    });
    await prisma.users.deleteMany({
      where: { id: { in: userIds } }
    });
    await app.close();
  }
});
