import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app';
import { canTransitionConversation, runtimeConversationStatuses } from '../src/modules/stage4/conversationStatus';
import { prisma } from '../src/db/prisma';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('runtime consultation status vocabulary is normalized and ACTIVE is reachable', () => {
  assert.deepEqual(runtimeConversationStatuses, ['QUEUED','ASSIGNED','ACTIVE','WAITING_USER','WAITING_COUNSELOR','ESCALATED','CLOSED','CANCELLED']);
  assert.equal(canTransitionConversation('ASSIGNED', 'ACTIVE'), true);
  assert.equal(canTransitionConversation('ACTIVE', 'WAITING_USER'), true);
  assert.equal(canTransitionConversation('ACTIVE', 'WAITING_COUNSELOR'), true);
  assert.equal(canTransitionConversation('CLOSED', 'ACTIVE'), false);
  assert.equal(canTransitionConversation('CANCELLED', 'QUEUED'), false);
});

test('legacy create endpoint is closed while legacy read routes remain registered', async () => {
  const app = await buildApp();
  await app.ready();
  try {
    const patient = await prisma.users.findFirstOrThrow({ where: { role: 'PASIEN', is_active: true }, select: { id: true, session_version: true } });
    const token = app.auth.signAccessToken({ userId: patient.id, role: 'PASIEN', sessionVersion: patient.session_version });
    const response = await app.inject({ method: 'POST', url: '/consultations', headers: { authorization: `Bearer ${token}` }, payload: { initial_complaint: 'uji kompatibilitas' } });
    assert.equal(response.statusCode, 410);
    assert.equal(response.json().replacement_endpoint, '/counselor-conversations');
    assert.match(source('src/modules/consultations/consultations.routes.ts'), /fastify\.get\(\s*'\/:id'/);
  } finally { await app.close(); }
});

test('counselor workflow migration is additive and models every required state', () => {
  const sql = source('prisma/migrations/20260810102000_counselor_application_workflow/migration.sql');
  assert.doesNotMatch(sql, /\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  for (const status of ['DRAFT','SUBMITTED','UNDER_REVIEW','REVISION_REQUIRED','VERIFIED','ACTIVE','INACTIVE','REJECTED','SUSPENDED']) assert.match(sql, new RegExp(`'${status}'`));
  for (const table of ['counselor_applications','counselor_documents','counselor_review_events','counselor_status_history']) assert.match(sql, new RegExp(`CREATE TABLE "${table}"`));
});

test('self application cannot write verification, activation, permission, capacity override, or admin role fields', () => {
  const routes = source('src/modules/stage4/counselorApplications.routes.ts');
  const profileSchema = routes.slice(routes.indexOf('const profileSchema'), routes.indexOf('const registerSchema'));
  for (const forbidden of ['verification_status','permission_enabled','is_active','is_available','max_active_conversations']) assert.equal(profileSchema.includes(forbidden), false);
  assert.doesNotMatch(profileSchema, /(?:^|[,\s])role\s*:/);
  assert.match(routes, /verification_status: verified \? 'VERIFIED'/);
  assert.match(routes, /permission_enabled: active/);
  assert.match(routes, /item\.verified_at/);
});

test('private counselor documents use random storage keys, signature checks, signed URLs, and audited reads', () => {
  const storage = source('src/modules/stage4/stage4.storage.ts');
  const routes = source('src/modules/stage4/counselorApplications.routes.ts');
  assert.match(storage, /counselor-documents\/\$\{randomUUID\(\)\}/);
  assert.match(routes, /verifyAttachmentObject/);
  assert.match(routes, /download_url: await downloadUrl/);
  assert.match(routes, /resourceType: 'COUNSELOR_DOCUMENT'/);
  assert.doesNotMatch(routes, /original_?name|filename/i);
});

test('report review and complaint reassignment enforce RBAC, audit, race checks, and reasons', () => {
  const reports = source('src/modules/stage4/reviewOperations.routes.ts');
  const complaints = source('src/modules/stage4/complaints.routes.ts');
  assert.match(reports, /\['ADMIN', 'SUPERVISOR'\]/);
  assert.match(reports, /CONVERSATION_REPORT_CONTEXT/);
  assert.match(reports, /assigned_reviewer: null/);
  assert.match(reports, /RESTRICT_CONVERSATION/);
  assert.match(reports, /REDACT_MESSAGE/);
  assert.match(complaints, /Alasan reassignment wajib diisi/);
  assert.match(complaints, /assigned_officer_id:t\.assigned_officer_id/);
  assert.match(complaints, /action:reassign\?'REASSIGN':'ASSIGN'/);
});

test('phantom PENDAMPING role is absent from active frontend contracts and routes', () => {
  for (const path of ['../sehaticare-web/src/types/auth.ts','../sehaticare-web/src/lib/roles.ts','../sehaticare-web/src/App.tsx','../sehaticare-web/src/layouts/AppShell.tsx']) assert.doesNotMatch(source(path), /PENDAMPING/);
});
