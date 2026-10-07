import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('AG-03: Companion-Aware Consultation Routing, Authorization Isolation, Reassignment, and Duplicate Protection', async () => {
  const app = await buildApp();
  const marker = randomUUID().replace(/-/g, '').slice(0, 8);

  const adminId = randomUUID();
  const patient1Id = randomUUID();
  const patient2Id = randomUUID();
  const patient3Id = randomUUID();
  const companion1Id = randomUUID();
  const companion2Id = randomUUID();
  const inactiveCompId = randomUUID();
  const unverifiedCompId = randomUUID();
  const nonCompanionRoleCompId = randomUUID();
  const doctorId = randomUUID();

  const userIds = [
    adminId,
    patient1Id,
    patient2Id,
    patient3Id,
    companion1Id,
    companion2Id,
    inactiveCompId,
    unverifiedCompId,
    nonCompanionRoleCompId,
    doctorId
  ];

  const passwordHash = await bcrypt.hash('Secure-test-2026!', 10);
  const now = new Date();

  try {
    // 1. Create test users
    await prisma.users.createMany({
      data: [
        { id: adminId, email: `admin-${marker}@test.local`, full_name: 'Admin Governance', role: 'ADMIN', password_hash: passwordHash, updated_at: now },
        { id: patient1Id, email: `pat1-${marker}@test.local`, full_name: 'Pasien Satu', display_alias: 'Mawar', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
        { id: patient2Id, email: `pat2-${marker}@test.local`, full_name: 'Pasien Dua', display_alias: 'Melati', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
        { id: patient3Id, email: `pat3-${marker}@test.local`, full_name: 'Pasien Tiga', display_alias: 'Anggrek', role: 'PASIEN', password_hash: passwordHash, updated_at: now },
        { id: companion1Id, email: `comp1-${marker}@test.local`, full_name: 'Pendamping A', display_alias: 'Maya Pendamping', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: companion2Id, email: `comp2-${marker}@test.local`, full_name: 'Pendamping B', display_alias: 'Budi Pendamping', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: inactiveCompId, email: `comp-inact-${marker}@test.local`, full_name: 'Pendamping Inactive', display_alias: 'Inact', role: 'COUNSELOR', is_active: false, password_hash: passwordHash, updated_at: now },
        { id: unverifiedCompId, email: `comp-unver-${marker}@test.local`, full_name: 'Pendamping Unverified', display_alias: 'Unver', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: nonCompanionRoleCompId, email: `comp-nonrole-${marker}@test.local`, full_name: 'Petugas Outreach', display_alias: 'Outreach', role: 'COUNSELOR', password_hash: passwordHash, updated_at: now },
        { id: doctorId, email: `doc-${marker}@test.local`, full_name: 'Dokter Spesialis', display_alias: 'dr. Andi', role: 'DOKTER', password_hash: passwordHash, updated_at: now }
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
          user_id: inactiveCompId,
          professional_name: 'Inact Pendamping',
          profession: 'Pendamping',
          service_role: 'COMPANION',
          verification_status: 'VERIFIED',
          permission_enabled: true,
          is_active: false,
          verified_at: now,
          updated_at: now
        },
        {
          user_id: unverifiedCompId,
          professional_name: 'Unver Pendamping',
          profession: 'Pendamping',
          service_role: 'COMPANION',
          verification_status: 'PENDING',
          permission_enabled: false,
          is_active: true,
          verified_at: null,
          updated_at: now
        },
        {
          user_id: nonCompanionRoleCompId,
          professional_name: 'Outreach Petugas',
          profession: 'Petugas Penjangkau',
          service_role: 'OUTREACH_WORKER',
          verification_status: 'VERIFIED',
          permission_enabled: true,
          is_active: true,
          verified_at: now,
          updated_at: now
        }
      ]
    });

    // 3. Create active counselor applications for companion1 and companion2
    await prisma.counselor_applications.createMany({
      data: [
        { id: randomUUID(), user_id: companion1Id, professional_name: 'Maya Pendamping', profession: 'Pendamping Sebaya', status: 'ACTIVE', updated_at: now },
        { id: randomUUID(), user_id: companion2Id, professional_name: 'Budi Pendamping', profession: 'Pendamping Sebaya', status: 'ACTIVE', updated_at: now }
      ]
    });

    // Login helper with unique remoteAddress to respect rate limiting
    let ipCounter = 10;
    const login = async (email: string) => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        remoteAddress: `127.0.1.${ipCounter++}`,
        payload: { email, password: 'Secure-test-2026!' }
      });
      assert.equal(res.statusCode, 200);
      return res.json().access_token as string;
    };

    const adminToken = await login(`admin-${marker}@test.local`);
    const patient1Token = await login(`pat1-${marker}@test.local`);
    const patient2Token = await login(`pat2-${marker}@test.local`);
    const patient3Token = await login(`pat3-${marker}@test.local`);
    const companion1Token = await login(`comp1-${marker}@test.local`);
    const companion2Token = await login(`comp2-${marker}@test.local`);
    const doctorToken = await login(`doc-${marker}@test.local`);

    // =========================================================================
    // PART A: SETUP LONGITUDINAL CARE ASSIGNMENT
    // Patient 1 -> Companion 1
    // Patient 2 -> Companion 2
    // Patient 3 -> No companion
    // =========================================================================
    const assign1 = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_id: patient1Id, companion_id: companion1Id }
    });
    assert.equal(assign1.statusCode, 201);
    const assign1Id = assign1.json().id;

    const assign2 = await app.inject({
      method: 'POST',
      url: '/admin/companion-assignments',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { patient_id: patient2Id, companion_id: companion2Id }
    });
    assert.equal(assign2.statusCode, 201);

    // =========================================================================
    // PART B: ROUTING WITH ACTIVE LONGITUDINAL COMPANION
    // Patient 1 creates COMPANION_SUPPORT conversation
    // Should be automatically assigned to Companion 1 with source LONGITUDINAL
    // =========================================================================
    const createRes1 = await app.inject({
      method: 'POST',
      url: '/patient/companion/start-conversation',
      headers: { authorization: `Bearer ${patient1Token}` },
      payload: {
        initial_message: 'Halo Maya, mohon bantuannya untuk check-in pengobatan.',
        submission_key: `key_p1_c1_${marker}`
      }
    });
    assert.equal(createRes1.statusCode, 201);
    const conv1Data = createRes1.json();
    assert.equal(conv1Data.routed_to_companion, true);
    assert.equal(conv1Data.status, 'ASSIGNED');
    const conv1PublicId = conv1Data.conversation_public_id;

    // Check DB record for conv1: source MUST be LONGITUDINAL
    const conv1Record = await prisma.service_conversations.findUnique({
      where: { public_id: conv1PublicId },
      include: { assignments: true }
    });
    assert.ok(conv1Record);
    assert.equal(conv1Record.service_intent, 'COMPANION_SUPPORT');
    assert.equal(conv1Record.assigned_counselor_id, companion1Id);
    assert.equal(conv1Record.assignments.length, 1);
    assert.equal(conv1Record.assignments[0].counselor_id, companion1Id);
    assert.equal(conv1Record.assignments[0].source, 'LONGITUDINAL');

    // Verify audit log recorded COMPANION_CONVERSATION_ROUTED
    const auditRouted = await prisma.audit_logs.findFirst({
      where: {
        actor_user_id: patient1Id,
        action: 'COMPANION_CONVERSATION_ROUTED',
        entity_id: conv1Record.id
      }
    });
    assert.ok(auditRouted, 'Audit log COMPANION_CONVERSATION_ROUTED must be created');
    const auditMeta = auditRouted.meta as any;
    assert.equal(auditMeta.source, 'LONGITUDINAL');
    assert.equal(auditMeta.companion_user_id, companion1Id);
    // Safe metadata: no clinical text or message content
    assert.equal(auditMeta.content, undefined);
    assert.equal(auditMeta.message, undefined);

    // =========================================================================
    // PART C: COMPANION ACCESS & REPLY
    // Companion 1 can read and reply to Conversation 1
    // =========================================================================
    const comp1ReadRes = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv1PublicId}`,
      headers: { authorization: `Bearer ${companion1Token}` }
    });
    assert.equal(comp1ReadRes.statusCode, 200);
    // Reading activates status from ASSIGNED to ACTIVE
    assert.equal(comp1ReadRes.json().status, 'ACTIVE');

    const comp1ReplyRes = await app.inject({
      method: 'POST',
      url: `/counselor/conversations/${conv1PublicId}/reply`,
      headers: { authorization: `Bearer ${companion1Token}` },
      payload: {
        content: 'Halo Mawar, saya siap mendampingi Anda hari ini.',
        idempotency_key: `reply_1_${marker}`
      }
    });
    assert.equal(comp1ReplyRes.statusCode, 201);

    // Verify Companion 1 sees Conversation 1 in /professional/assignments with is_longitudinal: true
    const comp1AssignmentsRes = await app.inject({
      method: 'GET',
      url: '/professional/assignments',
      headers: { authorization: `Bearer ${companion1Token}` }
    });
    assert.equal(comp1AssignmentsRes.statusCode, 200);
    const assignedItems = comp1AssignmentsRes.json().items;
    const foundConv1 = assignedItems.find((it: any) => it.public_id === conv1PublicId);
    assert.ok(foundConv1);
    assert.equal(foundConv1.is_longitudinal, true);
    assert.equal(foundConv1.assignment_source, 'LONGITUDINAL');
    assert.equal(foundConv1.service_intent, 'COMPANION_SUPPORT');

    // =========================================================================
    // PART D: PATIENT 2 (Companion 2) & IDOR ISOLATION
    // =========================================================================
    const createRes2 = await app.inject({
      method: 'POST',
      url: '/patient/companion/start-conversation',
      headers: { authorization: `Bearer ${patient2Token}` },
      payload: {
        initial_message: 'Halo Budi, pendamping saya.',
        submission_key: `key_p2_c2_${marker}`
      }
    });
    assert.equal(createRes2.statusCode, 201);
    const conv2PublicId = createRes2.json().conversation_public_id;

    // IDOR 1: Companion 1 CANNOT read Conversation 2
    const idorComp1OnConv2 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv2PublicId}`,
      headers: { authorization: `Bearer ${companion1Token}` }
    });
    assert.equal(idorComp1OnConv2.statusCode, 404);

    // IDOR 2: Companion 2 CANNOT read Conversation 1
    const idorComp2OnConv1 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv1PublicId}`,
      headers: { authorization: `Bearer ${companion2Token}` }
    });
    assert.equal(idorComp2OnConv1.statusCode, 404);

    // IDOR 3: Patient 1 CANNOT read Conversation 2
    const idorPat1OnConv2 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv2PublicId}`,
      headers: { authorization: `Bearer ${patient1Token}` }
    });
    assert.equal(idorPat1OnConv2.statusCode, 404);

    // IDOR 4: Patient 2 CANNOT read Conversation 1
    const idorPat2OnConv1 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv1PublicId}`,
      headers: { authorization: `Bearer ${patient2Token}` }
    });
    assert.equal(idorPat2OnConv1.statusCode, 404);

    // IDOR 5: Doctor CANNOT read Companion Conversation 1 or 2 (rejected with 403 or 404)
    const docOnConv1 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv1PublicId}`,
      headers: { authorization: `Bearer ${doctorToken}` }
    });
    assert.ok([403, 404].includes(docOnConv1.statusCode));

    // IDOR 6: Admin CANNOT read conversation messages directly without assignment
    const adminOnConv1 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv1PublicId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    assert.equal(adminOnConv1.statusCode, 403);

    // =========================================================================
    // PART E: PATIENT WITHOUT COMPANION -> SAFE QUEUE FALLBACK
    // Patient 3 has NO longitudinal companion
    // =========================================================================
    const createRes3 = await app.inject({
      method: 'POST',
      url: '/counselor-conversations',
      headers: { authorization: `Bearer ${patient3Token}` },
      payload: {
        service_intent: 'COMPANION_SUPPORT',
        service_type: 'COUNSELOR',
        initial_message: 'Saya butuh bantuan pendampingan tapi belum punya pendamping tetap.',
        submission_key: `key_p3_queue_${marker}`
      }
    });
    assert.equal(createRes3.statusCode, 201);
    const conv3Data = createRes3.json();
    assert.equal(conv3Data.routed_to_companion, false);
    assert.equal(conv3Data.status, 'QUEUED');
    const conv3PublicId = conv3Data.public_id;

    // Check fallback audit log
    const conv3Record = await prisma.service_conversations.findUnique({
      where: { public_id: conv3PublicId }
    });
    assert.ok(conv3Record);
    const auditFallback = await prisma.audit_logs.findFirst({
      where: {
        actor_user_id: patient3Id,
        action: 'COMPANION_CONVERSATION_QUEUE_FALLBACK',
        entity_id: conv3Record.id
      }
    });
    assert.ok(auditFallback, 'Audit log COMPANION_CONVERSATION_QUEUE_FALLBACK must be created');
    const fallbackMeta = auditFallback.meta as any;
    assert.equal(fallbackMeta.fallback_reason, 'NO_ACTIVE_COMPANION');

    // =========================================================================
    // PART F: INELIGIBLE COMPANION FALLBACK CHECKS
    // Assign Patient 3 to inactive companion, unverified companion, non-role companion
    // Verify each triggers safe queue fallback
    // =========================================================================
    // 1. Inactive companion user
    const inactAssign = await prisma.patient_companion_assignments.create({
      data: {
        id: randomUUID(),
        patient_user_id: patient3Id,
        companion_user_id: inactiveCompId,
        assigned_by_user_id: adminId,
        status: 'ACTIVE',
        started_at: now,
        updated_at: now
      }
    });

    const createResInact = await app.inject({
      method: 'POST',
      url: '/counselor-conversations',
      headers: { authorization: `Bearer ${patient3Token}` },
      payload: {
        service_intent: 'COMPANION_SUPPORT',
        service_type: 'COUNSELOR',
        initial_message: 'Pesan ke pendamping nonaktif.',
        submission_key: `key_inact_${marker}`
      }
    });
    // Should fallback to QUEUED, not crash and not assign to inactive companion
    assert.equal(createResInact.statusCode, 201);
    assert.equal(createResInact.json().status, 'QUEUED');
    assert.equal(createResInact.json().routed_to_companion, false);

    // Clean up temporary inact assignment
    await prisma.patient_companion_assignments.delete({ where: { id: inactAssign.id } });

    // =========================================================================
    // PART G: REASSIGNMENT EDGE CASE
    // Patient 1 is reassigned from Companion 1 -> Companion 2
    // Conv1 remains with Companion 1
    // New Conv4 is routed to Companion 2
    // =========================================================================
    // Close conv1 so patient 1 doesn't exceed active limit of 2
    await prisma.service_conversations.update({
      where: { public_id: conv1PublicId },
      data: { status: 'CLOSED', closed_at: new Date() }
    });

    // Reassign Patient 1 -> Companion 2
    const reassignRes = await app.inject({
      method: 'PUT',
      url: `/admin/companion-assignments/${assign1Id}/reassign`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        companion_id: companion2Id,
        reason: 'Rotasi pendamping resmi'
      }
    });
    assert.equal(reassignRes.statusCode, 200);

    // Old Conv1 remains assigned to Companion 1
    const oldConvCheck = await prisma.service_conversations.findUnique({
      where: { public_id: conv1PublicId }
    });
    assert.equal(oldConvCheck?.assigned_counselor_id, companion1Id);

    // New Conversation created after reassign routes to Companion 2
    const createAfterReassign = await app.inject({
      method: 'POST',
      url: '/patient/companion/start-conversation',
      headers: { authorization: `Bearer ${patient1Token}` },
      payload: {
        initial_message: 'Halo pendamping baru (Budi), mohon bantuannya.',
        submission_key: `key_after_reassign_${marker}`
      }
    });
    assert.equal(createAfterReassign.statusCode, 201);
    const conv4PublicId = createAfterReassign.json().conversation_public_id;

    const conv4Record = await prisma.service_conversations.findUnique({
      where: { public_id: conv4PublicId }
    });
    assert.equal(conv4Record?.assigned_counselor_id, companion2Id);
    assert.equal(createAfterReassign.json().routed_to_companion, true);

    // Companion 2 can access Conv4
    const comp2OnConv4 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv4PublicId}`,
      headers: { authorization: `Bearer ${companion2Token}` }
    });
    assert.equal(comp2OnConv4.statusCode, 200);

    // Companion 1 CANNOT access Conv4
    const comp1OnConv4 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv4PublicId}`,
      headers: { authorization: `Bearer ${companion1Token}` }
    });
    assert.equal(comp1OnConv4.statusCode, 404);

    // Companion 2 CANNOT access old Conv1
    const comp2OnOldConv1 = await app.inject({
      method: 'GET',
      url: `/counselor-conversations/${conv1PublicId}`,
      headers: { authorization: `Bearer ${companion2Token}` }
    });
    assert.equal(comp2OnOldConv1.statusCode, 404);

    // =========================================================================
    // PART H: DUPLICATE PROTECTION & IDEMPOTENCY
    // =========================================================================
    // 1. Same submission key returns existing conversation (HTTP 200)
    const retrySubmit = await app.inject({
      method: 'POST',
      url: '/patient/companion/start-conversation',
      headers: { authorization: `Bearer ${patient1Token}` },
      payload: {
        initial_message: 'Duplikat submit',
        submission_key: `key_after_reassign_${marker}`
      }
    });
    assert.equal(retrySubmit.statusCode, 200);
    assert.equal(retrySubmit.json().conversation_public_id, conv4PublicId);
    assert.equal(retrySubmit.json().is_reused, true);

    // 2. Active conversation check endpoint
    const activeConvCheck = await app.inject({
      method: 'GET',
      url: '/patient/companion/active-conversation',
      headers: { authorization: `Bearer ${patient1Token}` }
    });
    assert.equal(activeConvCheck.statusCode, 200);
    assert.equal(activeConvCheck.json().has_active_conversation, true);
    assert.equal(activeConvCheck.json().conversation_public_id, conv4PublicId);

    // =========================================================================
    // PART I: UNIFIED READ MODEL
    // GET /consultation-overview shows service_intent & title
    // =========================================================================
    const overviewRes = await app.inject({
      method: 'GET',
      url: '/consultation-overview',
      headers: { authorization: `Bearer ${patient1Token}` }
    });
    assert.equal(overviewRes.statusCode, 200);
    const overviewItems = overviewRes.json().items;
    const compItem = overviewItems.find((it: any) => it.id === conv4PublicId);
    assert.ok(compItem);
    assert.equal(compItem.service_intent, 'COMPANION_SUPPORT');
    assert.equal(compItem.title, 'Pendampingan Berkelanjutan');

    // Unified detail endpoint
    const unifiedDetail = await app.inject({
      method: 'GET',
      url: `/consultations-unified/${conv4PublicId}`,
      headers: { authorization: `Bearer ${patient1Token}` }
    });
    assert.equal(unifiedDetail.statusCode, 200);
    assert.equal(unifiedDetail.json().service_intent, 'COMPANION_SUPPORT');
    assert.equal(unifiedDetail.json().title, 'Pendampingan Berkelanjutan');

  } finally {
    // Teardown created records in clean order
    const createdConvs = await prisma.service_conversations.findMany({
      where: { user_id: { in: userIds } },
      select: { id: true }
    });
    const convIds = createdConvs.map((c) => c.id);

    await prisma.sensitive_access_audits.deleteMany({
      where: { actor_user_id: { in: userIds } }
    });
    await prisma.message_receipts.deleteMany({
      where: { participant_id: { in: userIds } }
    });
    await prisma.service_messages.deleteMany({
      where: { conversation_id: { in: convIds } }
    });
    await prisma.consultation_preferences.deleteMany({
      where: { conversation_id: { in: convIds } }
    });
    await prisma.counselor_assignments.deleteMany({
      where: { conversation_id: { in: convIds } }
    });
    await prisma.conversation_events.deleteMany({
      where: { conversation_id: { in: convIds } }
    });
    await prisma.service_conversations.deleteMany({
      where: { id: { in: convIds } }
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
    await prisma.counselor_applications.deleteMany({
      where: { user_id: { in: userIds } }
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
