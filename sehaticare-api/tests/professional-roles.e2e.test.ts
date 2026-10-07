import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('companion and outreach worker capabilities are enforced by HTTP routes', async () => {
  const suffix = randomUUID().slice(0, 8);
  const now = new Date();
  const companion = await prisma.users.create({ data: { id: randomUUID(), email: `data-uji-pendamping-${suffix}@sehaticare.local`, full_name: '[DATA UJI] Pendamping', role: 'COUNSELOR', account_mode: 'LEGACY', is_active: true, updated_at: now } });
  const outreach = await prisma.users.create({ data: { id: randomUUID(), email: `data-uji-penjangkau-${suffix}@sehaticare.local`, full_name: '[DATA UJI] Penjangkau', role: 'COUNSELOR', account_mode: 'LEGACY', is_active: true, updated_at: now } });
  for (const [user, serviceRole, profession] of [[companion, 'COMPANION', 'Pendamping'], [outreach, 'OUTREACH_WORKER', 'Penjangkau']] as const) {
    await prisma.counselor_applications.create({ data: { id: randomUUID(), user_id: user.id, status: 'ACTIVE', professional_name: user.full_name, profession, service_role: serviceRole, verified_at: now, activated_at: now, updated_at: now } });
    await prisma.counselor_profiles.create({ data: { user_id: user.id, permission_enabled: true, verification_status: 'VERIFIED', professional_name: user.full_name, profession, service_role: serviceRole, is_available: true, is_active: true, verified_at: now, updated_at: now } });
  }
  const app = await buildApp();
  await app.ready();
  try {
    const token = (user: typeof companion) => app.auth.signAccessToken({ userId: user.id, role: user.role, sessionVersion: user.session_version });
    const headers = (user: typeof companion) => ({ authorization: `Bearer ${token(user)}`, 'content-type': 'application/json' });
    const companionQueue = await app.inject({ method: 'GET', url: '/counselor/queue', headers: headers(companion) });
    assert.equal(companionQueue.statusCode, 403, companionQueue.body);
    const assignments = await app.inject({ method: 'GET', url: '/professional/assignments', headers: headers(companion) });
    assert.equal(assignments.statusCode, 200, assignments.body);
    const outreachQueue = await app.inject({ method: 'GET', url: '/counselor/queue', headers: headers(outreach) });
    assert.equal(outreachQueue.statusCode, 403, outreachQueue.body);
    const invalid = await app.inject({ method: 'POST', url: '/outreach/cases', headers: headers(outreach), payload: { title: 'Kebutuhan dukungan', summary: 'Hubungi datauji@example.com untuk tindak lanjut.' } });
    assert.equal(invalid.statusCode, 400, invalid.body);
    const created = await app.inject({ method: 'POST', url: '/outreach/cases', headers: headers(outreach), payload: { title: 'Kebutuhan dukungan', summary: 'Kelompok membutuhkan informasi rujukan layanan yang aman.' } });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(Object.prototype.hasOwnProperty.call(created.json(), 'id'), false);
    const referred = await app.inject({ method: 'POST', url: `/outreach/cases/${created.json().public_id}/refer`, headers: headers(outreach), payload: { target: 'COUNSELOR', note: 'Dirujuk untuk dukungan lanjutan melalui alur resmi.' } });
    assert.equal(referred.statusCode, 200, referred.body);
    assert.equal(referred.json().status, 'REFERRED');
  } finally {
    await prisma.audit_logs.deleteMany({ where: { actor_user_id: { in: [companion.id, outreach.id] } } });
    await prisma.professional_outreach_cases.deleteMany({ where: { created_by: outreach.id } });
    await prisma.counselor_profiles.deleteMany({ where: { user_id: { in: [companion.id, outreach.id] } } });
    await prisma.counselor_applications.deleteMany({ where: { user_id: { in: [companion.id, outreach.id] } } });
    await prisma.users.deleteMany({ where: { id: { in: [companion.id, outreach.id] } } });
    await app.close();
  }
});
