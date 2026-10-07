import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/db/prisma';

const FORBIDDEN_PUBLIC_FIELDS = new Set([
  'password',
  'password_hash',
  'phone',
  'phone_e164',
  'email',
  'refresh_token',
  'session_token',
  'otp',
  'storage_key',
  'upload_url'
]);

function assertSafePublicResponse(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertSafePublicResponse);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(FORBIDDEN_PUBLIC_FIELDS.has(key), false, `forbidden public field: ${key}`);
    assertSafePublicResponse(nested);
  }
}

function assertSafeGateTarget(): void {
  assert.notEqual(env.NODE_ENV, 'production', 'gate E2E refuses production NODE_ENV');
  const url = new URL(env.DATABASE_URL);
  assert.equal(
    ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase()),
    true,
    'gate E2E only permits a loopback PostgreSQL target'
  );
}

test('PostgreSQL gate validates login, authorization, messaging, and fixture cleanup', async () => {
  assertSafeGateTarget();

  const suffix = randomUUID();
  const ids = {
    patientA: randomUUID(),
    patientB: randomUUID(),
    doctorA: randomUUID(),
    doctorB: randomUUID(),
    admin: randomUUID(),
    consultationA: randomUUID(),
    consultationB: randomUUID()
  };
  const userIds = [ids.patientA, ids.patientB, ids.doctorA, ids.doctorB, ids.admin];
  const consultationIds = [ids.consultationA, ids.consultationB];
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);
  const emails = {
    patientA: `gate-patient-a-${suffix}@example.invalid`,
    patientB: `gate-patient-b-${suffix}@example.invalid`,
    doctorA: `gate-doctor-a-${suffix}@example.invalid`,
    doctorB: `gate-doctor-b-${suffix}@example.invalid`,
    admin: `gate-admin-${suffix}@example.invalid`
  };
  const before = {
    users: await prisma.users.count(),
    consultations: await prisma.consultations.count(),
    messages: await prisma.chat_messages.count(),
    refreshTokens: await prisma.refresh_tokens.count()
  };
  const app = await buildApp();

  async function login(email: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password }
    });
    assert.equal(response.statusCode, 200);
    const body = response.json<{ access_token: string }>();
    assert.equal(typeof body.access_token, 'string');
    return body.access_token;
  }

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.users.createMany({
        data: [
          { id: ids.patientA, role: 'PASIEN', email: emails.patientA, full_name: 'Gate Patient A', password_hash: passwordHash, updated_at: now },
          { id: ids.patientB, role: 'PASIEN', email: emails.patientB, full_name: 'Gate Patient B', password_hash: passwordHash, updated_at: now },
          { id: ids.doctorA, role: 'DOKTER', email: emails.doctorA, full_name: 'Gate Doctor A', password_hash: passwordHash, updated_at: now },
          { id: ids.doctorB, role: 'DOKTER', email: emails.doctorB, full_name: 'Gate Doctor B', password_hash: passwordHash, updated_at: now },
          { id: ids.admin, role: 'ADMIN', email: emails.admin, full_name: 'Gate Admin', password_hash: passwordHash, updated_at: now }
        ]
      }),
      prisma.doctor_profiles.createMany({
        data: [
          { user_id: ids.doctorA, verification_status: 'VERIFIED', updated_at: now },
          { user_id: ids.doctorB, verification_status: 'VERIFIED', updated_at: now }
        ]
      }),
      prisma.consultations.createMany({
        data: [
          {
            id: ids.consultationA,
            patient_id: ids.patientA,
            assignedDoctorId: ids.doctorA,
            status: 'DOKTER_AKTIF',
            initial_complaint: 'Synthetic gate consultation A',
            consent_at: now,
            consent_version: 'gate-v1',
            updated_at: now
          },
          {
            id: ids.consultationB,
            patient_id: ids.patientB,
            assignedDoctorId: ids.doctorB,
            status: 'DOKTER_AKTIF',
            initial_complaint: 'Synthetic gate consultation B',
            consent_at: now,
            consent_version: 'gate-v1',
            updated_at: now
          }
        ]
      })
    ]);

    const patientA = await login(emails.patientA);
    const patientB = await login(emails.patientB);
    const doctorA = await login(emails.doctorA);
    const doctorB = await login(emails.doctorB);
    const admin = await login(emails.admin);

    const unauthenticated = await app.inject({ method: 'GET', url: `/consultations/${ids.consultationA}` });
    assert.equal(unauthenticated.statusCode, 401);

    const ownPatient = await app.inject({
      method: 'GET',
      url: `/consultations/${ids.consultationA}`,
      headers: auth(patientA)
    });
    assert.equal(ownPatient.statusCode, 200);
    assertSafePublicResponse(ownPatient.json());

    const foreignPatient = await app.inject({
      method: 'GET',
      url: `/consultations/${ids.consultationB}`,
      headers: auth(patientA)
    });
    assert.equal(foreignPatient.statusCode, 403);

    const assignedDoctor = await app.inject({
      method: 'GET',
      url: `/doctor/consultations/${ids.consultationA}`,
      headers: auth(doctorA)
    });
    assert.equal(assignedDoctor.statusCode, 200);
    assertSafePublicResponse(assignedDoctor.json());

    const unassignedDoctor = await app.inject({
      method: 'GET',
      url: `/doctor/consultations/${ids.consultationA}`,
      headers: auth(doctorB)
    });
    assert.equal(unassignedDoctor.statusCode, 404);

    const wrongRole = await app.inject({
      method: 'GET',
      url: `/doctor/consultations/${ids.consultationA}`,
      headers: auth(patientB)
    });
    assert.equal(wrongRole.statusCode, 403);

    const adminMedicalAccess = await app.inject({
      method: 'GET',
      url: `/consultations/${ids.consultationA}`,
      headers: auth(admin)
    });
    assert.equal(adminMedicalAccess.statusCode, 403);

    const createdMessage = await app.inject({
      method: 'POST',
      url: `/consultations/${ids.consultationA}/messages`,
      headers: auth(patientA),
      payload: {
        content: 'Synthetic gate message',
        sender_user_id: ids.doctorB,
        owner_id: ids.patientB
      }
    });
    assert.equal(createdMessage.statusCode, 200);
    assertSafePublicResponse(createdMessage.json());

    const stored = await prisma.chat_messages.findFirstOrThrow({
      where: { consultation_id: ids.consultationA, content: 'Synthetic gate message' },
      select: { sender_user_id: true, sender_role: true, voice_note_id: true }
    });
    assert.equal(stored.sender_user_id, ids.patientA);
    assert.equal(stored.sender_role, 'PASIEN');
    assert.equal(stored.voice_note_id, null);

    const ownMessages = await app.inject({
      method: 'GET',
      url: `/consultations/${ids.consultationA}/messages`,
      headers: auth(patientA)
    });
    assert.equal(ownMessages.statusCode, 200);
    assertSafePublicResponse(ownMessages.json());

    const foreignMessages = await app.inject({
      method: 'GET',
      url: `/consultations/${ids.consultationA}/messages`,
      headers: auth(patientB)
    });
    assert.equal(foreignMessages.statusCode, 404);
  } finally {
    await app.close();
    await prisma.$transaction(async (tx) => {
      await tx.audit_events.deleteMany({
        where: { OR: [{ actor_user_id: { in: userIds } }, { consultation_id: { in: consultationIds } }] }
      });
      await tx.audit_logs.deleteMany({
        where: { OR: [{ actor_user_id: { in: userIds } }, { entity_id: { in: consultationIds } }] }
      });
      await tx.ai_events.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.chat_messages.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.consultation_messages.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.voice_note_upload_sessions.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.voice_notes.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.consultation_participants.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.consultations.deleteMany({ where: { id: { in: consultationIds } } });
      await tx.refresh_tokens.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.doctor_profiles.deleteMany({ where: { user_id: { in: [ids.doctorA, ids.doctorB] } } });
      await tx.users.deleteMany({ where: { id: { in: userIds } } });
    });
  }

  assert.deepEqual(
    {
      users: await prisma.users.count(),
      consultations: await prisma.consultations.count(),
      messages: await prisma.chat_messages.count(),
      refreshTokens: await prisma.refresh_tokens.count()
    },
    before,
    'gate fixture cleanup must restore baseline counts'
  );
});
