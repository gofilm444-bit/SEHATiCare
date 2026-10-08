import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { NEUTRAL_CONTROL, NEUTRAL_MEDICATION, NEUTRAL_UPDATE, neutralTextIsSafe } from '../src/modules/healthPlanning/scheduler.service';

test('AG-09: Device-Level Safety & Privacy Foundation API', async () => {
  const app = await buildApp();
  const marker = randomUUID();
  const passwordA = 'UserSecret-2026A!';
  const passwordB = 'UserSecret-2026B!';
  const userAId = randomUUID();
  const userBId = randomUUID();

  const userA = await prisma.users.create({
    data: {
      id: userAId,
      email: `privacy-a-${marker}@example.test`,
      full_name: 'Pasien Privacy A',
      role: 'PASIEN',
      password_hash: await bcrypt.hash(passwordA, 4),
      updated_at: new Date()
    }
  });

  const userB = await prisma.users.create({
    data: {
      id: userBId,
      email: `privacy-b-${marker}@example.test`,
      full_name: 'Pasien Privacy B',
      role: 'PASIEN',
      password_hash: await bcrypt.hash(passwordB, 4),
      updated_at: new Date()
    }
  });

  const tokenA = app.auth.signAccessToken({
    userId: userA.id,
    role: userA.role,
    sessionVersion: userA.session_version
  });

  const tokenB = app.auth.signAccessToken({
    userId: userB.id,
    role: userB.role,
    sessionVersion: userB.session_version
  });

  try {
    // 1. Unauthenticated access to /me/privacy-preferences is rejected
    const unauthGet = await app.inject({
      method: 'GET',
      url: '/me/privacy-preferences'
    });
    assert.equal(unauthGet.statusCode, 401);

    // 2. GET /me/privacy-preferences returns default settings for user A
    const getResA = await app.inject({
      method: 'GET',
      url: '/me/privacy-preferences',
      headers: { authorization: `Bearer ${tokenA}` }
    });
    assert.equal(getResA.statusCode, 200);
    const prefsA = getResA.json();
    assert.equal(prefsA.lock_on_background, true);
    assert.equal(prefsA.auto_lock_minutes, 5);
    assert.equal(prefsA.require_reauth_to_unlock, false);
    assert.equal(prefsA.discreet_page_titles, true);
    assert.ok(prefsA.created_at);
    assert.ok(prefsA.updated_at);

    // 3. PATCH /me/privacy-preferences updates user A's settings
    const patchResA = await app.inject({
      method: 'PATCH',
      url: '/me/privacy-preferences',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        lock_on_background: false,
        auto_lock_minutes: 15,
        require_reauth_to_unlock: true,
        discreet_page_titles: false
      }
    });
    assert.equal(patchResA.statusCode, 200);
    const updatedA = patchResA.json();
    assert.equal(updatedA.lock_on_background, false);
    assert.equal(updatedA.auto_lock_minutes, 15);
    assert.equal(updatedA.require_reauth_to_unlock, true);
    assert.equal(updatedA.discreet_page_titles, false);

    // Verify user B's preferences remain unaffected (IDOR protection)
    const getResB = await app.inject({
      method: 'GET',
      url: '/me/privacy-preferences',
      headers: { authorization: `Bearer ${tokenB}` }
    });
    assert.equal(getResB.statusCode, 200);
    const prefsB = getResB.json();
    assert.equal(prefsB.lock_on_background, true);
    assert.equal(prefsB.auto_lock_minutes, 5);
    assert.equal(prefsB.require_reauth_to_unlock, false);

    // 4. Strict validation rejects unrecognized properties
    const invalidPropRes = await app.inject({
      method: 'PATCH',
      url: '/me/privacy-preferences',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        auto_lock_minutes: 5,
        unknown_metadata: 'attacker_payload'
      }
    });
    assert.equal(invalidPropRes.statusCode, 400);

    // 5. Validation rejects invalid auto_lock_minutes values
    const invalidMinutesRes = await app.inject({
      method: 'PATCH',
      url: '/me/privacy-preferences',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        auto_lock_minutes: 99
      }
    });
    assert.equal(invalidMinutesRes.statusCode, 400);

    // 6. Valid allowed auto_lock_minutes (null, 0, 1, 5, 15, 30) accepted
    for (const val of [null, 0, 1, 5, 30]) {
      const validValRes = await app.inject({
        method: 'PATCH',
        url: '/me/privacy-preferences',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { auto_lock_minutes: val }
      });
      assert.equal(validValRes.statusCode, 200);
      assert.equal(validValRes.json().auto_lock_minutes, val);
    }

    // 7. Audit log recorded for privacy preference updates without sensitive data
    const auditEvents = await prisma.audit_events.findMany({
      where: {
        actor_user_id: userA.id,
        action: 'PRIVACY_PREFERENCE_UPDATED'
      }
    });
    assert.ok(auditEvents.length > 0);
    for (const event of auditEvents) {
      const meta = event.meta_json as Record<string, unknown> | null;
      assert.ok(meta);
      assert.equal(typeof meta.changed_fields !== 'undefined', true);
      assert.equal(typeof (meta as any).password, 'undefined');
      assert.equal(typeof (meta as any).token, 'undefined');
    }

    // 8. POST /auth/re-authenticate with correct password succeeds and returns cryptographic proof
    const reauthSuccess = await app.inject({
      method: 'POST',
      url: '/auth/re-authenticate',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { password: passwordA }
    });
    assert.equal(reauthSuccess.statusCode, 200);
    const reauthData = reauthSuccess.json();
    assert.equal(reauthData.ok, true);
    assert.ok(reauthData.reauthenticated_at);
    assert.equal(reauthData.expires_in_seconds, 300);
    assert.ok(typeof reauthData.proof_token === 'string' && reauthData.proof_token.length > 20);

    // 8b. Cryptographic proof is verified for current user
    const verifySuccess = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { proof_token: reauthData.proof_token }
    });
    assert.equal(verifySuccess.statusCode, 200);
    assert.equal(verifySuccess.json().valid, true);

    // 8c. Proof cannot be reused by another account (User B rejected with 403)
    const verifyCrossUser = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { proof_token: reauthData.proof_token }
    });
    assert.equal(verifyCrossUser.statusCode, 403);

    // 8d. Tampered or invalid proof rejected with 401
    const verifyInvalid = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { proof_token: 'tampered.jwt.token' }
    });
    assert.equal(verifyInvalid.statusCode, 401);

    // 9. POST /auth/re-authenticate with wrong password fails
    const reauthFail = await app.inject({
      method: 'POST',
      url: '/auth/re-authenticate',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { password: 'WrongPassword123!' }
    });
    assert.equal(reauthFail.statusCode, 401);

    // 10. Audit log recorded for re-auth success and failure
    const successAudits = await prisma.audit_events.findMany({
      where: {
        actor_user_id: userA.id,
        action: 'PRIVACY_REAUTH_SUCCESS'
      }
    });
    assert.ok(successAudits.length >= 1);

    const failAudits = await prisma.audit_events.findMany({
      where: {
        actor_user_id: userA.id,
        action: 'PRIVACY_REAUTH_FAILED'
      }
    });
    assert.ok(failAudits.length >= 1);

    // Ensure audit events NEVER log password
    for (const evt of [...successAudits, ...failAudits]) {
      const metaStr = JSON.stringify(evt.meta_json ?? {});
      assert.equal(metaStr.includes('UserSecret'), false);
      assert.equal(metaStr.includes('WrongPassword'), false);
    }

    // 11. Notification copy safety test
    const notificationCopies = [
      NEUTRAL_MEDICATION,
      NEUTRAL_CONTROL,
      NEUTRAL_UPDATE,
      'Anda memiliki pesan baru.',
      'Anda memiliki pembaruan baru.'
    ];

    const unsafeTerms = [
      /\bHIV\b/i,
      /\bAIDS\b/i,
      /\bARV\b/i,
      /\bART\b/i,
      /\bODHIV\b/i,
      /\bviral\s*load\b/i,
      /\bCD4\b/i
    ];

    for (const copy of notificationCopies) {
      for (const pattern of unsafeTerms) {
        assert.equal(
          pattern.test(copy),
          false,
          `Notification copy "${copy}" must not contain sensitive term matching ${pattern}`
        );
      }
    }

    // 12. Migration count invariant: exactly 26 migrations
    const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
    const migrations = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    assert.equal(migrations.length, 26, 'Expected exactly 26 database migrations');
    assert.ok(
      migrations.includes('20260823090000_privacy_mode_device_safety'),
      'Migration 20260823090000_privacy_mode_device_safety must be present'
    );
  } finally {
    await prisma.user_privacy_preferences.deleteMany({
      where: { user_id: { in: [userAId, userBId] } }
    });
    await prisma.audit_events.deleteMany({
      where: { actor_user_id: { in: [userAId, userBId] } }
    });
    await prisma.users.deleteMany({
      where: { id: { in: [userAId, userBId] } }
    });
    await app.close();
  }
});
