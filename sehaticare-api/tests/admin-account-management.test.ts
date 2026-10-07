import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('superadmin capability is server-authorized and credentials stay out of list responses', async () => {
  const app = await buildApp();
  try {
    const superadmin = await prisma.users.findUnique({
      where: { email: 'admin@sehaticare.local' },
      select: { id: true, role: true, is_superadmin: true, session_version: true }
    });
    assert.ok(superadmin);
    assert.equal(superadmin.role, 'ADMIN');
    assert.equal(superadmin.is_superadmin, true);
    const token = app.auth.signAccessToken({ userId: superadmin.id, role: 'ADMIN', sessionVersion: superadmin.session_version });
    const response = await app.inject({ method: 'GET', url: '/admin/users?page=1&pageSize=20', headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.is_superadmin, true);
    assert.ok(Array.isArray(payload.items));
    for (const item of payload.items) {
      assert.equal('password_hash' in item, false);
      assert.equal('login_id' in item, false);
      assert.equal('recovery_code_hash' in item, false);
      assert.equal('email' in item, false);
    }
  } finally {
    await app.close();
  }
});

test('ordinary admin cannot create privileged or other managed accounts', async () => {
  const app = await buildApp();
  try {
    const admin = await prisma.users.findFirst({
      where: { role: 'ADMIN', is_superadmin: false, is_active: true },
      select: { id: true, session_version: true }
    });
    assert.ok(admin, 'A regular admin fixture is required');
    const token = app.auth.signAccessToken({ userId: admin.id, role: 'ADMIN', sessionVersion: admin.session_version });
    const response = await app.inject({
      method: 'POST',
      url: '/admin/users',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        email: 'must-not-be-created@example.test',
        full_name: 'Akun Tidak Boleh Dibuat',
        role: 'ADMIN',
        password: 'aman12345',
        password_confirmation: 'aman12345'
      }
    });
    assert.equal(response.statusCode, 403);
    assert.equal(await prisma.users.count({ where: { email: 'must-not-be-created@example.test' } }), 0);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
});
