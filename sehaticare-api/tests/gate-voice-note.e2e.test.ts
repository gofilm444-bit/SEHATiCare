import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Client } from 'minio';
import { buildApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/db/prisma';
import { commitUpload } from '../src/modules/voiceNotes/voiceNotes.service';

function storageUrl() {
  const raw = /^[a-z][a-z0-9+.-]*:\/\//i.test(env.STORAGE_ENDPOINT)
    ? env.STORAGE_ENDPOINT
    : `${env.STORAGE_USE_SSL ? 'https' : 'http'}://${env.STORAGE_ENDPOINT}`;
  const url = new URL(raw);
  if (!url.port && env.STORAGE_PORT) url.port = String(env.STORAGE_PORT);
  return url;
}

function assertSafeGateTarget() {
  assert.notEqual(env.NODE_ENV, 'production');
  const database = new URL(env.DATABASE_URL);
  const storage = storageUrl();
  for (const host of [database.hostname, storage.hostname]) {
    assert.equal(['localhost', '127.0.0.1', '::1'].includes(host.toLowerCase()), true);
  }
}

function createStorageClient() {
  const url = storageUrl();
  return new Client({
    endPoint: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    useSSL: url.protocol === 'https:',
    accessKey: env.STORAGE_ACCESS_KEY,
    secretKey: env.STORAGE_SECRET_KEY,
    region: env.STORAGE_REGION
  });
}

function listGateObjects(client: Client): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const names: string[] = [];
    const stream = client.listObjectsV2(env.STORAGE_BUCKET, 'voice-notes/', true);
    stream.on('data', (item) => {
      if (item.name) names.push(item.name);
    });
    stream.on('error', reject);
    stream.on('end', () => resolve(names));
  });
}

test('MinIO and voice-note gate validates storage, relation, authorization, and retry', async () => {
  assertSafeGateTarget();
  const storage = createStorageClient();
  assert.equal(await storage.bucketExists(env.STORAGE_BUCKET), true);
  const objectsBefore = await listGateObjects(storage);

  const suffix = randomUUID();
  const ids = {
    patientA: randomUUID(),
    patientB: randomUUID(),
    doctorA: randomUUID(),
    doctorB: randomUUID(),
    consultationA: randomUUID(),
    consultationB: randomUUID()
  };
  const userIds = [ids.patientA, ids.patientB, ids.doctorA, ids.doctorB];
  const consultationIds = [ids.consultationA, ids.consultationB];
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 12);
  const emails = {
    patientA: `gate-voice-patient-a-${suffix}@example.invalid`,
    patientB: `gate-voice-patient-b-${suffix}@example.invalid`,
    doctorA: `gate-voice-doctor-a-${suffix}@example.invalid`,
    doctorB: `gate-voice-doctor-b-${suffix}@example.invalid`
  };
  const app = await buildApp();
  const storageKeys = new Set<string>();

  async function login(email: string) {
    const response = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
    assert.equal(response.statusCode, 200);
    return response.json<{ access_token: string }>().access_token;
  }
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function requestUpload(token: string, consultationId: string, type: string, size: number) {
    return app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/voice-notes/upload-url`,
      headers: auth(token),
      payload: { content_type: type, file_size_bytes: size }
    });
  }

  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.users.createMany({
        data: [
          { id: ids.patientA, role: 'PASIEN', email: emails.patientA, full_name: 'Gate Voice Patient A', password_hash: passwordHash, updated_at: now },
          { id: ids.patientB, role: 'PASIEN', email: emails.patientB, full_name: 'Gate Voice Patient B', password_hash: passwordHash, updated_at: now },
          { id: ids.doctorA, role: 'DOKTER', email: emails.doctorA, full_name: 'Gate Voice Doctor A', password_hash: passwordHash, updated_at: now },
          { id: ids.doctorB, role: 'DOKTER', email: emails.doctorB, full_name: 'Gate Voice Doctor B', password_hash: passwordHash, updated_at: now }
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
          { id: ids.consultationA, patient_id: ids.patientA, assignedDoctorId: ids.doctorA, status: 'DOKTER_AKTIF', initial_complaint: 'Synthetic voice gate A', consent_at: now, consent_version: 'gate-v1', updated_at: now },
          { id: ids.consultationB, patient_id: ids.patientB, assignedDoctorId: ids.doctorB, status: 'DOKTER_AKTIF', initial_complaint: 'Synthetic voice gate B', consent_at: now, consent_version: 'gate-v1', updated_at: now }
        ]
      })
    ]);

    const patientA = await login(emails.patientA);
    const patientB = await login(emails.patientB);
    const doctorA = await login(emails.doctorA);
    const doctorB = await login(emails.doctorB);

    const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04]);
    const uploadResponse = await requestUpload(patientA, ids.consultationA, 'audio/webm', audio.length);
    assert.equal(uploadResponse.statusCode, 200);
    const upload = uploadResponse.json<{ upload_url: string; upload_session_id: string }>();
    const uploadUrl = new URL(upload.upload_url);
    assert.equal(['localhost', '127.0.0.1', '::1'].includes(uploadUrl.hostname), true);
    const session = await prisma.voice_note_upload_sessions.findUniqueOrThrow({
      where: { id: upload.upload_session_id },
      select: { storage_key: true }
    });
    storageKeys.add(session.storage_key);

    const put = await fetch(upload.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'audio/webm' },
      body: audio
    });
    assert.equal(put.ok, true);

    const commit = await app.inject({
      method: 'POST',
      url: `/consultations/${ids.consultationA}/voice-notes/commit`,
      headers: auth(patientA),
      payload: {
        upload_session_id: upload.upload_session_id,
        content_type: 'audio/webm',
        file_size_bytes: audio.length
      }
    });
    assert.equal(commit.statusCode, 200);
    const committed = commit.json<{ id: string; message_id: string; content_type: string; file_size_bytes: number }>();
    assert.equal(committed.content_type, 'audio/webm');
    assert.equal(committed.file_size_bytes, audio.length);
    assert.equal(Object.prototype.hasOwnProperty.call(committed, 'storage_key'), false);

    const relation = await prisma.chat_messages.findUniqueOrThrow({
      where: { id: committed.message_id },
      select: { consultation_id: true, sender_user_id: true, voice_note_id: true }
    });
    assert.deepEqual(relation, {
      consultation_id: ids.consultationA,
      sender_user_id: ids.patientA,
      voice_note_id: committed.id
    });

    const voice = await prisma.voice_notes.findUniqueOrThrow({
      where: { id: committed.id },
      select: { consultation_id: true, uploaded_by: true, storage_key: true }
    });
    assert.equal(voice.consultation_id, ids.consultationA);
    assert.equal(voice.uploaded_by, ids.patientA);
    assert.match(voice.storage_key, /^voice-notes\/[0-9a-f-]{36}$/);
    assert.equal(voice.storage_key.includes(ids.patientA), false);
    assert.equal(voice.storage_key.includes(ids.consultationA), false);

    for (const token of [patientA, doctorA]) {
      const download = await app.inject({ method: 'GET', url: `/voice-notes/${committed.id}`, headers: auth(token) });
      assert.equal(download.statusCode, 200);
      const body = download.json<{ download_url: string }>();
      assert.equal(Object.prototype.hasOwnProperty.call(body, 'storage_key'), false);
      const downloaded = await fetch(body.download_url);
      assert.equal(downloaded.ok, true);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), audio);
    }

    for (const token of [patientB, doctorB]) {
      const denied = await app.inject({ method: 'GET', url: `/voice-notes/${committed.id}`, headers: auth(token) });
      assert.equal(denied.statusCode, 404);
    }
    const noAuth = await app.inject({ method: 'GET', url: `/voice-notes/${committed.id}` });
    assert.equal(noAuth.statusCode, 401);
    const invalidId = await app.inject({ method: 'GET', url: `/voice-notes/${randomUUID()}`, headers: auth(patientA) });
    assert.equal(invalidId.statusCode, 404);

    assert.equal((await requestUpload(patientA, ids.consultationA, 'image/png', 10)).statusCode, 400);
    assert.equal((await requestUpload(patientA, ids.consultationA, 'audio/webm', 0)).statusCode, 400);
    assert.equal((await requestUpload(patientA, ids.consultationA, 'audio/webm', 10 * 1024 * 1024 + 1)).statusCode, 400);

    const fake = Buffer.from('not an audio file');
    const fakeUploadResponse = await requestUpload(patientA, ids.consultationA, 'audio/webm', fake.length);
    assert.equal(fakeUploadResponse.statusCode, 200);
    const fakeUpload = fakeUploadResponse.json<{ upload_url: string; upload_session_id: string }>();
    const fakeSession = await prisma.voice_note_upload_sessions.findUniqueOrThrow({
      where: { id: fakeUpload.upload_session_id },
      select: { storage_key: true }
    });
    storageKeys.add(fakeSession.storage_key);
    assert.equal(
      (await fetch(fakeUpload.upload_url, { method: 'PUT', headers: { 'Content-Type': 'audio/webm' }, body: fake })).ok,
      true
    );
    const fakeCommit = await app.inject({
      method: 'POST',
      url: `/consultations/${ids.consultationA}/voice-notes/commit`,
      headers: auth(patientA),
      payload: { upload_session_id: fakeUpload.upload_session_id, content_type: 'audio/webm', file_size_bytes: fake.length }
    });
    assert.equal(fakeCommit.statusCode, 400);
    await assert.rejects(() => storage.statObject(env.STORAGE_BUCKET, fakeSession.storage_key));
    storageKeys.delete(fakeSession.storage_key);

    const missingUploadResponse = await requestUpload(patientA, ids.consultationA, 'audio/webm', audio.length);
    assert.equal(missingUploadResponse.statusCode, 200);
    const missingUpload = missingUploadResponse.json<{ upload_session_id: string }>();
    const missingCommit = await app.inject({
      method: 'POST',
      url: `/consultations/${ids.consultationA}/voice-notes/commit`,
      headers: auth(patientA),
      payload: { upload_session_id: missingUpload.upload_session_id, content_type: 'audio/webm', file_size_bytes: audio.length }
    });
    assert.equal(missingCommit.statusCode, 400);

    const retry = await app.inject({
      method: 'POST',
      url: `/consultations/${ids.consultationA}/voice-notes/commit`,
      headers: auth(patientA),
      payload: { upload_session_id: upload.upload_session_id, content_type: 'audio/webm', file_size_bytes: audio.length }
    });
    assert.equal(retry.statusCode, 400);
    assert.equal(await prisma.voice_notes.count({ where: { id: committed.id } }), 1);
    assert.equal(await prisma.chat_messages.count({ where: { voice_note_id: committed.id } }), 1);

    const raceUploadResponse = await requestUpload(patientB, ids.consultationB, 'audio/webm', audio.length);
    assert.equal(raceUploadResponse.statusCode, 200);
    const raceUpload = raceUploadResponse.json<{ upload_url: string; upload_session_id: string }>();
    const raceSession = await prisma.voice_note_upload_sessions.findUniqueOrThrow({
      where: { id: raceUpload.upload_session_id },
      select: { storage_key: true }
    });
    storageKeys.add(raceSession.storage_key);
    assert.equal(
      (await fetch(raceUpload.upload_url, { method: 'PUT', headers: { 'Content-Type': 'audio/webm' }, body: audio })).ok,
      true
    );
    await prisma.consultations.update({ where: { id: ids.consultationB }, data: { status: 'SELESAI' } });
    await assert.rejects(() =>
      commitUpload({
        consultationId: ids.consultationB,
        uploadSessionId: raceUpload.upload_session_id,
        actorId: ids.patientB,
        actorRole: 'PASIEN',
        contentType: 'audio/webm',
        fileSizeBytes: audio.length
      })
    );
    await assert.rejects(() => storage.statObject(env.STORAGE_BUCKET, raceSession.storage_key));
    storageKeys.delete(raceSession.storage_key);
    assert.equal(await prisma.voice_notes.count({ where: { consultation_id: ids.consultationB } }), 0);
    assert.equal(await prisma.chat_messages.count({ where: { consultation_id: ids.consultationB } }), 0);

    const missingVoiceId = randomUUID();
    await prisma.voice_notes.create({
      data: {
        id: missingVoiceId,
        consultation_id: ids.consultationA,
        uploaded_by: ids.patientA,
        storage_provider: 'minio',
        storage_key: `voice-notes/${randomUUID()}`,
        content_type: 'audio/webm',
        file_size_bytes: audio.length,
        updated_at: new Date()
      }
    });
    const missingFile = await app.inject({
      method: 'GET',
      url: `/voice-notes/${missingVoiceId}`,
      headers: auth(patientA)
    });
    assert.equal(missingFile.statusCode, 404);
    assert.deepEqual(missingFile.json(), { message: 'Voice note file not found' });

    const anonymousList = await fetch(`${storageUrl().origin}/${encodeURIComponent(env.STORAGE_BUCKET)}?list-type=2`);
    assert.equal(anonymousList.status, 403);
  } finally {
    await app.close();
    const sessions = await prisma.voice_note_upload_sessions.findMany({
      where: { consultation_id: { in: consultationIds } },
      select: { storage_key: true }
    });
    sessions.forEach((session) => storageKeys.add(session.storage_key));
    for (const key of storageKeys) {
      await storage.removeObject(env.STORAGE_BUCKET, key).catch(() => undefined);
    }
    await prisma.$transaction(async (tx) => {
      await tx.audit_events.deleteMany({ where: { OR: [{ actor_user_id: { in: userIds } }, { consultation_id: { in: consultationIds } }] } });
      await tx.audit_logs.deleteMany({ where: { OR: [{ actor_user_id: { in: userIds } }, { entity_id: { in: consultationIds } }] } });
      await tx.ai_events.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.chat_messages.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.consultation_messages.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.voice_notes.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.voice_note_upload_sessions.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.consultation_participants.deleteMany({ where: { consultation_id: { in: consultationIds } } });
      await tx.consultations.deleteMany({ where: { id: { in: consultationIds } } });
      await tx.refresh_tokens.deleteMany({ where: { user_id: { in: userIds } } });
      await tx.doctor_profiles.deleteMany({ where: { user_id: { in: [ids.doctorA, ids.doctorB] } } });
      await tx.users.deleteMany({ where: { id: { in: userIds } } });
    });
  }

  assert.deepEqual(await listGateObjects(storage), objectsBefore);
});
