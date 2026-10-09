import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { env } from '../src/config/env';

test('AG-09B: JWT Token-Type Isolation & True Re-Auth Session Binding', async (t) => {
  const app = await buildApp();
  const marker = randomUUID();
  const passwordA = 'PasswordA-2026-Secure!';
  const passwordB = 'PasswordB-2026-Secure!';

  // User A with password
  const userA = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: `jwt-a-${marker}@example.test`,
      full_name: 'User JWT Isolation A',
      role: 'PASIEN',
      password_hash: await bcrypt.hash(passwordA, 4),
      updated_at: new Date()
    }
  });

  // User B with password
  const userB = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: `jwt-b-${marker}@example.test`,
      full_name: 'User JWT Isolation B',
      role: 'PASIEN',
      password_hash: await bcrypt.hash(passwordB, 4),
      updated_at: new Date()
    }
  });

  // User C: passwordless / OTP-only user (no password_hash)
  const userC = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: `jwt-c-${marker}@example.test`,
      full_name: 'User Passwordless C',
      role: 'PASIEN',
      password_hash: null,
      updated_at: new Date()
    }
  });

  try {
    // -------------------------------------------------------------
    // 1. Initial Login for User A (Session A1)
    // -------------------------------------------------------------
    const loginResA1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: userA.email, password: passwordA }
    });
    assert.equal(loginResA1.statusCode, 200);
    const accessA1 = loginResA1.json().access_token;
    const refreshA1Cookie = loginResA1.cookies.find((c: any) => c.name === 'sehaticare_refresh')?.value;
    assert.ok(accessA1);
    assert.ok(refreshA1Cookie);

    const decodedAccessA1 = app.jwt.decode<{ tokenUse: string; sessionId: string }>(accessA1)!;
    const decodedRefreshA1 = app.auth.verifyRefreshToken(refreshA1Cookie);
    assert.equal(decodedAccessA1.tokenUse, 'ACCESS');
    assert.equal(decodedRefreshA1.tokenUse, 'REFRESH');
    assert.ok(decodedAccessA1.sessionId);
    assert.equal(decodedAccessA1.sessionId, decodedRefreshA1.sessionId, 'Access and refresh tokens must share the same sessionId');
    const sessionIdA1 = decodedAccessA1.sessionId;

    // -------------------------------------------------------------
    // 2. Issue Re-Auth Proof for Session A1
    // -------------------------------------------------------------
    const reauthResA1 = await app.inject({
      method: 'POST',
      url: '/auth/re-authenticate',
      headers: { authorization: `Bearer ${accessA1}` },
      payload: { password: passwordA }
    });
    assert.equal(reauthResA1.statusCode, 200);
    const proofA1 = reauthResA1.json().proof_token;
    assert.ok(proofA1);

    const decodedProofA1 = app.auth.verifyReauthProof(proofA1);
    assert.equal(decodedProofA1.tokenUse, 'PRIVACY_REAUTH');
    assert.equal(decodedProofA1.userId, userA.id);
    assert.equal(decodedProofA1.sessionId, sessionIdA1, 'Proof token must bind to the active session ID');

    // -------------------------------------------------------------
    // TEST MATRIX A: ACCESS as Bearer to protected endpoint => 200
    // -------------------------------------------------------------
    const resA = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${accessA1}` }
    });
    assert.equal(resA.statusCode, 200, 'Normal access token must be accepted by authGuard');

    // -------------------------------------------------------------
    // TEST MATRIX B: PRIVACY_REAUTH as Bearer to protected endpoint => 401
    // -------------------------------------------------------------
    const resB = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${proofA1}` }
    });
    assert.equal(resB.statusCode, 401, 'PRIVACY_REAUTH proof must be rejected by authGuard (NO TOKEN CONFUSION)');

    // -------------------------------------------------------------
    // TEST MATRIX C: REFRESH as Bearer to protected endpoint => 401
    // -------------------------------------------------------------
    const resC = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${refreshA1Cookie}` }
    });
    assert.equal(resC.statusCode, 401, 'REFRESH token must be rejected by authGuard');

    // -------------------------------------------------------------
    // TEST MATRIX D: ACCESS submitted as proof_token to /auth/verify-reauth => 401
    // -------------------------------------------------------------
    const resD = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessA1}` },
      payload: { proof_token: accessA1 }
    });
    assert.equal(resD.statusCode, 401, 'ACCESS token submitted as proof must be rejected');

    // -------------------------------------------------------------
    // TEST MATRIX E: REFRESH submitted as proof_token => 401
    // -------------------------------------------------------------
    const resE = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessA1}` },
      payload: { proof_token: refreshA1Cookie }
    });
    assert.equal(resE.statusCode, 401, 'REFRESH token submitted as proof must be rejected');

    // -------------------------------------------------------------
    // TEST MATRIX F: PRIVACY_REAUTH submitted as proof with matching session => 200 valid: true
    // -------------------------------------------------------------
    const resF = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessA1}` },
      payload: { proof_token: proofA1 }
    });
    assert.equal(resF.statusCode, 200);
    assert.equal(resF.json().valid, true, 'Valid reauth proof must be accepted in the same session');

    // -------------------------------------------------------------
    // TEST MATRIX G: Malformed JWT => 401
    // -------------------------------------------------------------
    const resG = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessA1}` },
      payload: { proof_token: 'not.a.valid.jwt' }
    });
    assert.equal(resG.statusCode, 401, 'Malformed proof token must be rejected');

    // -------------------------------------------------------------
    // TEST MATRIX H: Expired PRIVACY_REAUTH => 401
    // -------------------------------------------------------------
    const expiredProof = app.jwt.sign(
      {
        userId: userA.id,
        role: userA.role,
        sessionVersion: userA.session_version,
        sessionId: sessionIdA1,
        tokenUse: 'PRIVACY_REAUTH',
        nonce: randomUUID()
      },
      { expiresIn: '-1s', key: env.JWT_REAUTH_SECRET }
    );
    const resH = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessA1}` },
      payload: { proof_token: expiredProof }
    });
    assert.equal(resH.statusCode, 401, 'Expired proof token must be rejected');

    // -------------------------------------------------------------
    // TEST MATRIX I: Valid signature but wrong tokenUse => rejected
    // -------------------------------------------------------------
    const wrongTokenUse = app.jwt.sign(
      {
        userId: userA.id,
        role: userA.role,
        sessionVersion: userA.session_version,
        sessionId: sessionIdA1,
        tokenUse: 'UNKNOWN_USE' as any
      },
      { expiresIn: '5m', key: env.JWT_ACCESS_SECRET }
    );
    const resI = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${wrongTokenUse}` }
    });
    assert.equal(resI.statusCode, 401, 'Token with invalid tokenUse must be rejected by authGuard');

    // -------------------------------------------------------------
    // REFRESH ROTATION SESSION CONTINUITY:
    // Rotate refresh token => same sessionId preserved
    // Proof A1 remains valid through legitimate token refresh within same login session
    // -------------------------------------------------------------
    const csrfToken = loginResA1.cookies.find((c: any) => c.name === 'sehaticare_csrf')?.value;
    assert.ok(csrfToken);
    const refreshResA = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: `sehaticare_refresh=${refreshA1Cookie}; sehaticare_csrf=${csrfToken}`,
        'x-csrf-token': csrfToken
      }
    });
    assert.equal(refreshResA.statusCode, 200);
    const accessA2 = refreshResA.json().access_token;
    const refreshA2Cookie = refreshResA.cookies.find((c: any) => c.name === 'sehaticare_refresh')?.value;
    assert.ok(refreshA2Cookie);

    const decodedAccessA2 = app.jwt.decode<{ tokenUse: string; sessionId: string }>(accessA2)!;
    const decodedRefreshA2 = app.auth.verifyRefreshToken(refreshA2Cookie);
    assert.equal(decodedAccessA2.sessionId, sessionIdA1, 'Rotated access token MUST preserve original sessionId');
    assert.equal(decodedRefreshA2.sessionId, sessionIdA1, 'Rotated refresh token MUST preserve original sessionId');

    // Reauth proof issued before rotation is still valid with rotated access token A2
    const verifyUnderRotated = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessA2}` },
      payload: { proof_token: proofA1 }
    });
    assert.equal(verifyUnderRotated.statusCode, 200);
    assert.equal(verifyUnderRotated.json().valid, true, 'Proof A1 must remain valid under same-session rotated access token A2');

    // -------------------------------------------------------------
    // SESSION BINDING: Explicit new login User A creates new sessionId B
    // Old proof A1 cannot be used under Session B => 403
    // -------------------------------------------------------------
    const loginResA2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: userA.email, password: passwordA }
    });
    assert.equal(loginResA2.statusCode, 200);
    const accessA_Session2 = loginResA2.json().access_token;
    const decodedAccessA_Session2 = app.jwt.decode<{ tokenUse: string; sessionId: string }>(accessA_Session2)!;
    const sessionIdA2 = decodedAccessA_Session2.sessionId;

    assert.notEqual(sessionIdA1, sessionIdA2, 'New explicit login must generate a new, distinct sessionId');

    // Attempt to use Proof A1 (sessionIdA1) with Access Token from Session 2 (sessionIdA2) => 403 Forbidden
    const crossSessionRes = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessA_Session2}` },
      payload: { proof_token: proofA1 }
    });
    assert.equal(crossSessionRes.statusCode, 403, 'Cross-session proof reuse must be rejected with 403');

    // -------------------------------------------------------------
    // CROSS-USER BINDING: User A proof under User B access token => 403
    // -------------------------------------------------------------
    const loginResB = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: userB.email, password: passwordB }
    });
    assert.equal(loginResB.statusCode, 200);
    const accessB = loginResB.json().access_token;

    const crossUserRes = await app.inject({
      method: 'POST',
      url: '/auth/verify-reauth',
      headers: { authorization: `Bearer ${accessB}` },
      payload: { proof_token: proofA1 }
    });
    assert.equal(crossUserRes.statusCode, 403, 'Cross-user proof reuse must be rejected with 403');

    // -------------------------------------------------------------
    // PASSWORDLESS / OTP ACCOUNT PROTECTION:
    // User C has no password_hash. Attempting to enable require_reauth_to_unlock
    // must be rejected with 400 Bad Request to prevent permanent user lockout.
    // -------------------------------------------------------------
    const tokenC = app.auth.signAccessToken({
      userId: userC.id,
      role: userC.role,
      sessionVersion: userC.session_version
    });

    const enableReauthForPasswordless = await app.inject({
      method: 'PATCH',
      url: '/me/privacy-preferences',
      headers: { authorization: `Bearer ${tokenC}` },
      payload: { require_reauth_to_unlock: true }
    });
    assert.equal(enableReauthForPasswordless.statusCode, 400, 'Passwordless accounts cannot enable password-required re-auth unlock');
    assert.match(enableReauthForPasswordless.json().message, /kata sandi/i);

    // However, User A (who has a password) CAN enable require_reauth_to_unlock
    const enableReauthForPasswordUser = await app.inject({
      method: 'PATCH',
      url: '/me/privacy-preferences',
      headers: { authorization: `Bearer ${accessA_Session2}` },
      payload: { require_reauth_to_unlock: true }
    });
    assert.equal(enableReauthForPasswordUser.statusCode, 200);
    assert.equal(enableReauthForPasswordUser.json().require_reauth_to_unlock, true);
  } finally {
    const userIds = [userA.id, userB.id, userC.id];
    await prisma.user_privacy_preferences.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.refresh_tokens.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.audit_events.deleteMany({ where: { actor_user_id: { in: userIds } } });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  }
});
