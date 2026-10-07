import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toPublicUser,
  toSafeConsultationResponse,
  toSafeDoctorConsultationResponse,
  toSafeMessageResponse
} from '../src/modules/consultations/consultations.presenter';
import { ensureConsultationAccess } from '../src/modules/consultations/consultations.guards';
import { toSelfUserResponse } from '../src/modules/auth/auth.presenter';
import { toSafeDoctorProfileResponse } from '../src/modules/admin/admin.presenter';
import { toSafeEducationDetail } from '../src/modules/education/education.presenter';
import {
  toSafeVoiceNoteDownloadResponse,
  toSafeVoiceNoteResponse
} from '../src/modules/voiceNotes/voiceNotes.presenter';
import { toPublicErrorResponse } from '../src/utils/errorResponse';
import Fastify from 'fastify';
import { AuthUser } from '../src/modules/consultations/consultations.guards';
import { assertDemoSeedAllowed } from '../src/utils/seedPolicy';
import {
  assertUploadSessionValid,
  createVoiceNoteStorageKey,
  validateAudio,
  validateAudioSignature,
  validateUploadedObject
} from '../src/modules/voiceNotes/voiceNotes.policy';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  createCsrfToken,
  getCsrfCookieOptions,
  getRefreshCookieOptions,
  isValidCsrfToken
} from '../src/modules/auth/auth.session';
import { resolveCorsOrigins } from '../src/config/security';
import { sensitiveRateLimits } from '../src/config/rateLimits';
import { generateOtp } from '../src/utils/crypto';
import { buildApp } from '../src/app';
import { maskSensitiveText, sanitizeErrorForLog } from '../src/utils/logSanitizer';

const FORBIDDEN_RESPONSE_FIELDS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'email',
  'phone',
  'phone_e164',
  'phone_number',
  'refresh_token',
  'session_token',
  'otp',
  'secret'
]);

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.add(key);
    collectKeys(nested, keys);
  }
  return keys;
}

function assertHasNoSensitiveFields(value: unknown) {
  const keys = collectKeys(value);
  for (const forbidden of FORBIDDEN_RESPONSE_FIELDS) {
    assert.equal(keys.has(forbidden), false, `response contains forbidden field: ${forbidden}`);
  }
}

const now = new Date('2026-08-04T00:00:00.000Z');

test('consultation detail presenter only emits whitelisted fields', () => {
  const ormResult = {
    id: 'consultation-1',
    status: 'DOKTER_AKTIF',
    initial_complaint: 'Keluhan yang sah',
    opened_at: now,
    created_at: now,
    updated_at: now,
    closeRequested: false,
    consent_at: now,
    red_flag: false,
    password_hash: 'must-not-leak',
    email: 'must-not-leak@example.invalid',
    phone_e164: '+620000000000',
    refresh_token: 'must-not-leak'
  } as const;
  const response = toSafeConsultationResponse(ormResult);

  assert.equal(response.id, 'consultation-1');
  assert.equal(response.initial_complaint, 'Keluhan yang sah');
  assertHasNoSensitiveFields(response);
});

test('doctor consultation presenter exposes display name but no user credentials', () => {
  const ormResult = {
    id: 'consultation-1',
    status: 'MENUNGGU_DOKTER',
    initial_complaint: 'Keluhan',
    opened_at: now,
    created_at: now,
    updated_at: now,
    patient: {
      full_name: 'Nama Tampilan',
      email: 'must-not-leak@example.invalid',
      password_hash: 'must-not-leak',
      phone_e164: '+620000000000'
    }
  } as const;
  const response = toSafeDoctorConsultationResponse(ormResult);

  assert.deepEqual(response.patient, { full_name: 'Nama Tampilan' });
  assertHasNoSensitiveFields(response);
});

test('public user and message presenters cannot leak ORM-only identity fields', () => {
  const ormUser = {
    full_name: 'Nama Tampilan',
    email: 'must-not-leak@example.invalid',
    password_hash: 'must-not-leak'
  };
  const ormMessage = {
    id: 'message-1',
    sender_role: 'PASIEN',
    content: 'Pesan aman',
    created_at: now,
    sender_user_id: 'internal-user-id',
    consultation_id: 'internal-consultation-id'
  } as const;
  const user = toPublicUser(ormUser);
  const message = toSafeMessageResponse(ormMessage);

  assert.deepEqual(user, { full_name: 'Nama Tampilan' });
  assert.deepEqual(message, {
    id: 'message-1',
    sender_role: 'PASIEN',
    content: 'Pesan aman',
    created_at: now
  });
  assertHasNoSensitiveFields({ user, message });
});

test('an authenticated patient can still open their own consultation', () => {
  assert.doesNotThrow(() =>
    ensureConsultationAccess(
      {
        patient_id: 'patient-1',
        assignedDoctorId: null
      },
      { userId: 'patient-1', role: 'PASIEN' }
    )
  );
});

test('consultation authorization rejects foreign patients, unassigned doctors, and admins', () => {
  const consultation = { patient_id: 'patient-1', assignedDoctorId: 'doctor-1' };

  assert.doesNotThrow(() =>
    ensureConsultationAccess(consultation, { userId: 'patient-1', role: 'PASIEN' })
  );
  assert.doesNotThrow(() =>
    ensureConsultationAccess(consultation, { userId: 'doctor-1', role: 'DOKTER' })
  );
  assert.throws(() =>
    ensureConsultationAccess(consultation, { userId: 'patient-2', role: 'PASIEN' })
  );
  assert.throws(() =>
    ensureConsultationAccess(consultation, { userId: 'doctor-2', role: 'DOKTER' })
  );
  assert.throws(() =>
    ensureConsultationAccess(consultation, { userId: 'admin-1', role: 'ADMIN' })
  );
});

async function buildAuthorizationFixtureApp() {
  const app = Fastify({ logger: false });
  const users = new Map<string, AuthUser>([
    ['patient-1', { userId: 'patient-1', role: 'PASIEN' }],
    ['patient-2', { userId: 'patient-2', role: 'PASIEN' }],
    ['doctor-1', { userId: 'doctor-1', role: 'DOKTER' }],
    ['doctor-2', { userId: 'doctor-2', role: 'DOKTER' }],
    ['admin-1', { userId: 'admin-1', role: 'ADMIN' }]
  ]);
  const consultations = new Map([
    ['consultation-1', { id: 'consultation-1', patient_id: 'patient-1', assignedDoctorId: 'doctor-1' }],
    ['consultation-2', { id: 'consultation-2', patient_id: 'patient-2', assignedDoctorId: 'doctor-2' }]
  ]);
  const voiceNotes = new Map([
    ['voice-1', { id: 'voice-1', consultation_id: 'consultation-1' }],
    ['voice-2', { id: 'voice-2', consultation_id: 'consultation-2' }]
  ]);

  const authenticate = (authorization: string | undefined): AuthUser | null => {
    if (!authorization?.startsWith('Bearer ')) return null;
    return users.get(authorization.slice('Bearer '.length)) ?? null;
  };

  app.get('/consultations/:id', async (request, reply) => {
    const user = authenticate(request.headers.authorization);
    if (!user) return reply.code(401).send({ message: 'Unauthorized' });
    if (user.role !== 'PASIEN' && user.role !== 'DOKTER') {
      return reply.code(403).send({ message: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const consultation = consultations.get(id);
    if (!consultation) return reply.code(404).send({ message: 'Consultation not found' });
    try {
      ensureConsultationAccess(consultation, user);
    } catch {
      return reply.code(404).send({ message: 'Consultation not found' });
    }
    return reply.send({ id: consultation.id });
  });

  app.post('/consultations/:id/messages', async (request, reply) => {
    const user = authenticate(request.headers.authorization);
    if (!user) return reply.code(401).send({ message: 'Unauthorized' });
    if (user.role !== 'PASIEN' && user.role !== 'DOKTER') {
      return reply.code(403).send({ message: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const consultation = consultations.get(id);
    if (!consultation) return reply.code(404).send({ message: 'Consultation not found' });
    try {
      ensureConsultationAccess(consultation, user);
    } catch {
      return reply.code(404).send({ message: 'Consultation not found' });
    }
    const body = request.body as { content?: string; sender_user_id?: string };
    return reply.send({
      consultation_id: id,
      sender_user_id: user.userId,
      content: body.content ?? ''
    });
  });

  app.get('/voice-notes/:id', async (request, reply) => {
    const user = authenticate(request.headers.authorization);
    if (!user) return reply.code(401).send({ message: 'Unauthorized' });
    if (user.role !== 'PASIEN' && user.role !== 'DOKTER') {
      return reply.code(403).send({ message: 'Forbidden' });
    }
    const { id } = request.params as { id: string };
    const voiceNote = voiceNotes.get(id);
    if (!voiceNote) return reply.code(404).send({ message: 'Not found' });
    const consultation = consultations.get(voiceNote.consultation_id);
    if (!consultation) return reply.code(404).send({ message: 'Not found' });
    try {
      ensureConsultationAccess(consultation, user);
    } catch {
      return reply.code(404).send({ message: 'Not found' });
    }
    return reply.send({ id: voiceNote.id, download_url: 'signed-url-created-after-access-check' });
  });

  await app.ready();
  return app;
}

test('HTTP authorization integration rejects IDOR and ignores manipulated sender id', async (t) => {
  const app = await buildAuthorizationFixtureApp();
  t.after(() => app.close());

  const own = await app.inject({
    method: 'GET',
    url: '/consultations/consultation-1',
    headers: { authorization: 'Bearer patient-1' }
  });
  const foreign = await app.inject({
    method: 'GET',
    url: '/consultations/consultation-2',
    headers: { authorization: 'Bearer patient-1' }
  });
  const assignedDoctor = await app.inject({
    method: 'GET',
    url: '/consultations/consultation-1',
    headers: { authorization: 'Bearer doctor-1' }
  });
  const unassignedDoctor = await app.inject({
    method: 'GET',
    url: '/consultations/consultation-1',
    headers: { authorization: 'Bearer doctor-2' }
  });
  const wrongRole = await app.inject({
    method: 'GET',
    url: '/consultations/consultation-1',
    headers: { authorization: 'Bearer admin-1' }
  });
  const unauthenticated = await app.inject({ method: 'GET', url: '/consultations/consultation-1' });
  const manipulatedSender = await app.inject({
    method: 'POST',
    url: '/consultations/consultation-1/messages',
    headers: { authorization: 'Bearer patient-1' },
    payload: { content: 'Pesan', sender_user_id: 'patient-2' }
  });
  const ownVoiceNote = await app.inject({
    method: 'GET',
    url: '/voice-notes/voice-1',
    headers: { authorization: 'Bearer patient-1' }
  });
  const foreignVoiceNote = await app.inject({
    method: 'GET',
    url: '/voice-notes/voice-2',
    headers: { authorization: 'Bearer patient-1' }
  });

  assert.equal(own.statusCode, 200);
  assert.equal(foreign.statusCode, 404);
  assert.equal(assignedDoctor.statusCode, 200);
  assert.equal(unassignedDoctor.statusCode, 404);
  assert.equal(wrongRole.statusCode, 403);
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(manipulatedSender.statusCode, 200);
  assert.equal(manipulatedSender.json().sender_user_id, 'patient-1');
  assert.equal(ownVoiceNote.statusCode, 200);
  assert.equal(foreignVoiceNote.statusCode, 404);
});

test('self profile is explicitly mapped and never exposes authentication metadata', () => {
  const ormUser = {
    id: 'patient-1',
    public_id: 'usr_patient1',
    display_alias: null,
    account_mode: 'LEGACY',
    role: 'PASIEN',
    full_name: 'Pasien',
    phone_e164: '+620000000000',
    email: 'owner@example.invalid',
    password_hash: 'must-not-leak',
    refresh_tokens: [{ token_hash: 'must-not-leak' }],
    is_active: true,
    doctor_profiles_doctor_profiles_user_idTousers: null
  } as const;
  const response = toSelfUserResponse(ormUser);
  const keys = collectKeys(response);

  assert.equal(response.email, 'owner@example.invalid');
  assert.equal(keys.has('password_hash'), false);
  assert.equal(keys.has('refresh_tokens'), false);
  assert.equal(keys.has('token_hash'), false);
  assert.equal(keys.has('is_active'), false);
});

test('admin doctor profile response omits verifier identity', () => {
  const profile = {
    user_id: 'doctor-1',
    verification_status: 'VERIFIED',
    verified_at: now,
    verified_by: 'admin-internal-id',
    puskesmas_name: 'Puskesmas',
    str_number: 'STR-TEST',
    created_at: now,
    updated_at: now
  } as const;
  const response = toSafeDoctorProfileResponse(profile);

  assert.equal(Object.prototype.hasOwnProperty.call(response, 'verified_by'), false);
  assert.equal(response.verification_status, 'VERIFIED');
});

test('public education detail omits internal author identifiers', () => {
  const article = {
    id: 'article-1',
    title: 'Edukasi HIV',
    body_markdown: 'Isi artikel',
    created_at: now,
    created_by: 'internal-author-id',
    updated_by: 'internal-editor-id',
    is_published: true
  };
  const response = toSafeEducationDetail(article, {
    body_markdown: article.body_markdown,
    summary: null,
    category: null
  });

  assert.equal(Object.prototype.hasOwnProperty.call(response, 'created_by'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(response, 'updated_by'), false);
  assert.equal(response.category, 'HIV/AIDS');
});

test('voice note responses never expose storage keys, provider, or uploader identity', () => {
  const voiceNote = {
    id: 'voice-1',
    consultation_id: 'consultation-1',
    uploaded_by: 'patient-1',
    storage_provider: 'minio',
    storage_key: 'private/storage/key',
    content_type: 'audio/webm',
    file_size_bytes: 1024,
    created_at: now
  };
  const committed = toSafeVoiceNoteResponse(voiceNote);
  const download = toSafeVoiceNoteDownloadResponse(voiceNote, 'https://storage.invalid/signed');

  for (const response of [committed, download]) {
    const keys = collectKeys(response);
    assert.equal(keys.has('storage_key'), false);
    assert.equal(keys.has('storage_provider'), false);
    assert.equal(keys.has('uploaded_by'), false);
    assert.equal(keys.has('consultation_id'), false);
  }
  assert.equal(download.download_url, 'https://storage.invalid/signed');
});

test('public errors contain only a neutral message and correlation id', () => {
  const response = toPublicErrorResponse('Internal server error', 'request-123');

  assert.deepEqual(response, {
    message: 'Internal server error',
    correlation_id: 'request-123'
  });
  assert.equal(Object.prototype.hasOwnProperty.call(response, 'stack'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(response, 'target'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(response, 'query'), false);
});

test('demo seed fails closed in production and requires an environment password', () => {
  assert.throws(() => assertDemoSeedAllowed('production', 'development-only-value'));
  assert.throws(() => assertDemoSeedAllowed(undefined, 'development-only-value'));
  assert.throws(() => assertDemoSeedAllowed('development', undefined));
  assert.throws(() => assertDemoSeedAllowed('test', 'too-short'));
  assert.doesNotThrow(() =>
    assertDemoSeedAllowed('development', 'development-only-value')
  );
  assert.doesNotThrow(() => assertDemoSeedAllowed('test', 'testing-only-value'));
});

test('voice note policy validates MIME, size, upload owner, and stored object metadata', () => {
  assert.equal(validateAudio('audio/webm;codecs=opus', 1024), 'audio/webm');
  assert.throws(() => validateAudio('audio/svg+xml', 1024));
  assert.throws(() => validateAudio('audio/webm', 0));
  assert.throws(() => validateAudio('audio/webm', 10 * 1024 * 1024 + 1));

  const session = {
    consultation_id: 'consultation-1',
    requested_by: 'patient-1',
    committed_at: null,
    expires_at: new Date('2026-08-04T01:00:00.000Z'),
    content_type: 'audio/webm',
    file_size_bytes: 1024
  };
  assert.doesNotThrow(() =>
    assertUploadSessionValid(session, {
      consultationId: 'consultation-1',
      actorId: 'patient-1',
      now
    })
  );
  assert.throws(() =>
    assertUploadSessionValid(session, {
      consultationId: 'consultation-1',
      actorId: 'patient-2',
      now
    })
  );
  assert.throws(() =>
    assertUploadSessionValid(null, {
      consultationId: 'consultation-1',
      actorId: 'patient-1',
      now
    })
  );

  assert.doesNotThrow(() =>
    validateUploadedObject({
      requestedContentType: 'audio/webm',
      requestedFileSizeBytes: 1024,
      sessionContentType: 'audio/webm',
      sessionFileSizeBytes: 1024,
      object: { size: 1024, contentType: 'audio/webm' }
    })
  );
  assert.throws(() =>
    validateUploadedObject({
      requestedContentType: 'audio/webm',
      requestedFileSizeBytes: 1024,
      sessionContentType: 'audio/webm',
      sessionFileSizeBytes: 1024,
      object: null
    })
  );
  assert.throws(() =>
    validateUploadedObject({
      requestedContentType: 'audio/webm',
      requestedFileSizeBytes: 1024,
      sessionContentType: 'audio/webm',
      sessionFileSizeBytes: 1024,
      object: { size: 2048, contentType: 'audio/webm' }
    })
  );
});

test('voice note storage keys are random and contain no consultation identifier or traversal', () => {
  const key = createVoiceNoteStorageKey();
  assert.match(key, /^voice-notes\/[0-9a-f-]{36}$/);
  assert.equal(key.includes('consultation-1'), false);
  assert.equal(key.includes('..'), false);
  assert.equal(key.includes('\\'), false);
});

test('voice note policy validates audio magic bytes instead of trusting MIME metadata', () => {
  assert.doesNotThrow(() =>
    validateAudioSignature('audio/webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]))
  );
  assert.doesNotThrow(() => validateAudioSignature('audio/ogg', Buffer.from('OggS-test')));
  assert.doesNotThrow(() =>
    validateAudioSignature('audio/wav', Buffer.from('RIFF0000WAVEdata'))
  );
  assert.doesNotThrow(() => validateAudioSignature('audio/mpeg', Buffer.from('ID3-test')));
  assert.throws(() => validateAudioSignature('audio/webm', Buffer.from('not audio')));
});

test('voice note migration is additive and links active messages with a nullable foreign key', () => {
  const migration = readFileSync(
    path.resolve(
      process.cwd(),
      'prisma/migrations/20260804090000_link_chat_messages_voice_notes/migration.sql'
    ),
    'utf8'
  );
  assert.match(migration, /ADD COLUMN "voice_note_id" UUID/);
  assert.match(migration, /FOREIGN KEY \("voice_note_id"\) REFERENCES "voice_notes"\("id"\)/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test('safe chat message response carries the voice note relation without internal identities', () => {
  const response = toSafeMessageResponse({
    id: 'message-voice-1',
    sender_role: 'PASIEN',
    content: '[VOICE_NOTE]',
    created_at: now,
    voice_note_id: 'voice-1'
  });
  assert.equal(response.voice_note_id, 'voice-1');
  assert.equal(Object.prototype.hasOwnProperty.call(response, 'sender_user_id'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(response, 'consultation_id'), false);
});

test('authentication security policy uses cryptographic CSRF and OTP values', () => {
  const csrfOne = createCsrfToken();
  const csrfTwo = createCsrfToken();
  assert.notEqual(csrfOne, csrfTwo);
  assert.equal(isValidCsrfToken(csrfOne, csrfOne), true);
  assert.equal(isValidCsrfToken(`${csrfOne}x`, csrfOne), false);
  assert.equal(isValidCsrfToken(undefined, csrfOne), false);

  const productionRefreshCookie = getRefreshCookieOptions('production', 7);
  const developmentRefreshCookie = getRefreshCookieOptions('development', 7);
  const csrfCookie = getCsrfCookieOptions('production', 7);
  assert.equal(productionRefreshCookie.httpOnly, true);
  assert.equal(productionRefreshCookie.secure, true);
  assert.equal(productionRefreshCookie.sameSite, 'strict');
  assert.equal(developmentRefreshCookie.secure, false);
  assert.equal(csrfCookie.httpOnly, false);
  assert.equal(csrfCookie.secure, true);

  const otp = generateOtp();
  assert.match(otp, /^\d{6}$/);
});

test('production CORS fails closed and sensitive endpoint limits are bounded', () => {
  assert.deepEqual(resolveCorsOrigins('development', undefined), [
    'https://localhost:5173',
    'https://127.0.0.1:5173'
  ]);
  assert.deepEqual(resolveCorsOrigins('production', 'https://app.example.invalid'), [
    'https://app.example.invalid'
  ]);
  assert.throws(() => resolveCorsOrigins('production', undefined));
  assert.throws(() => resolveCorsOrigins('production', '*'));
  assert.equal(sensitiveRateLimits.login.max, 5);
  assert.equal(sensitiveRateLimits.otpRequest.max, 5);
  assert.equal(sensitiveRateLimits.voiceUploadUrl.max, 10);
});

test('application emits security headers and refresh JWTs are unique and verifiable', async (t) => {
  const app = await buildApp();
  t.after(() => app.close());
  const response = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { origin: 'https://localhost:5173' }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['access-control-allow-origin'], 'https://localhost:5173');
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.match(String(response.headers['x-correlation-id'] ?? ''), /^req-/);
  assert.match(response.headers['content-security-policy'] ?? '', /default-src 'none'/);

  const tokenOne = app.auth.signRefreshToken({ userId: 'patient-1', role: 'PASIEN', sessionVersion: 0 });
  const tokenTwo = app.auth.signRefreshToken({ userId: 'patient-1', role: 'PASIEN', sessionVersion: 0 });
  assert.notEqual(tokenOne, tokenTwo);
  assert.equal(app.auth.verifyRefreshToken(tokenOne).userId, 'patient-1');
});

test('log sanitizer masks contact data, credentials, and tokens', () => {
  const raw =
    'email test@example.invalid phone +62 812-3456-7890 Bearer opaque-value password=example token=example otp=123456';
  const masked = maskSensitiveText(raw);
  assert.doesNotMatch(masked, /test@example\.invalid|812-3456-7890|opaque-value|password=example|token=example|otp=123456/);
  assert.match(masked, /\[EMAIL_REDACTED\]|\[PHONE_REDACTED\]/);

  const safeError = sanitizeErrorForLog(new Error(raw));
  assert.doesNotMatch(safeError.message, /test@example\.invalid|opaque-value|123456/);
});

test('source logging policy excludes raw frontend errors and red-flag keywords from audit metadata', () => {
  const frontendClient = readFileSync(
    path.resolve(process.cwd(), '../sehaticare-web/src/api/client.ts'),
    'utf8'
  );
  const messageRoutes = readFileSync(
    path.resolve(process.cwd(), 'src/modules/messages/messages.routes.ts'),
    'utf8'
  );
  assert.doesNotMatch(frontendClient, /console\.(debug|log|error)/);
  assert.doesNotMatch(messageRoutes, /meta:\s*\{\s*matched/);
  assert.match(messageRoutes, /sanitizeErrorForLog/);
});

test('frontend auth no longer persists bearer tokens in Web Storage', () => {
  const authContext = readFileSync(
    path.resolve(process.cwd(), '../sehaticare-web/src/context/AuthContext.tsx'),
    'utf8'
  );
  assert.doesNotMatch(authContext, /localStorage\.setItem/);
  assert.match(authContext, /refreshSessionRequest/);
  assert.match(authContext, /logoutRequest/);
});
