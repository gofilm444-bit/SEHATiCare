import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app';
import { prisma } from '../src/db/prisma';

test('portal CMS: RBAC, CRUD, publication states, ordering, audit, and public isolation', async () => {
  const app = await buildApp();
  const marker = randomUUID();
  const adminId = randomUUID();
  const patientId = randomUUID();
  const adminEmail = `portal-admin-${marker}@example.test`;
  const patientEmail = `portal-patient-${marker}@example.test`;
  const createdPortalIds: string[] = [];

  try {
    await prisma.users.createMany({
      data: [
        {
          id: adminId,
          email: adminEmail,
          full_name: 'Admin Portal Test',
          role: 'ADMIN',
          password_hash: await bcrypt.hash('Admin-portal-2026', 12),
          updated_at: new Date()
        },
        {
          id: patientId,
          email: patientEmail,
          full_name: 'Pasien Portal Test',
          role: 'PASIEN',
          password_hash: await bcrypt.hash('Patient-portal-2026', 12),
          updated_at: new Date()
        }
      ]
    });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: adminEmail, password: 'Admin-portal-2026' }
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminToken = adminLogin.json().access_token;

    const patientLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: patientEmail, password: 'Patient-portal-2026' }
    });
    assert.equal(patientLogin.statusCode, 200);
    const patientToken = patientLogin.json().access_token;

    // 1. RBAC: non-admin forbidden from portal CMS
    const unauthList = await app.inject({ method: 'GET', url: '/admin/content/portal' });
    assert.equal(unauthList.statusCode, 401);

    const forbiddenList = await app.inject({
      method: 'GET',
      url: '/admin/content/portal',
      headers: { authorization: `Bearer ${patientToken}` }
    });
    assert.equal(forbiddenList.statusCode, 403);

    const forbiddenCreate = await app.inject({
      method: 'POST',
      url: '/admin/content/portal',
      headers: { authorization: `Bearer ${patientToken}` },
      payload: {
        section: 'faq',
        title: 'Forbidden FAQ',
        summary: 'Cannot create',
        publication_status: 'DRAFT',
        display_order: 1
      }
    });
    assert.equal(forbiddenCreate.statusCode, 403);

    // 2. Validation: Unsafe markup rejected
    const adminHeaders = { authorization: `Bearer ${adminToken}` };
    const unsafeCreate = await app.inject({
      method: 'POST',
      url: '/admin/content/portal',
      headers: adminHeaders,
      payload: {
        section: 'faq',
        title: '<script>alert("xss")</script>',
        summary: 'Test summary'
      }
    });
    assert.equal(unsafeCreate.statusCode, 400);

    // 3. Admin: list existing seeded portal items
    const adminList = await app.inject({
      method: 'GET',
      url: '/admin/content/portal',
      headers: adminHeaders
    });
    assert.equal(adminList.statusCode, 200);
    const listBody = adminList.json();
    assert.ok(Array.isArray(listBody.items));
    assert.ok(listBody.items.length >= 9);

    // 4. Admin: create draft portal item
    const createRes = await app.inject({
      method: 'POST',
      url: '/admin/content/portal',
      headers: adminHeaders,
      payload: {
        section: 'faq',
        title: `FAQ Uji ${marker.slice(0, 8)}`,
        summary: 'Ringkasan jawaban uji',
        publication_status: 'DRAFT',
        display_order: 99
      }
    });
    assert.equal(createRes.statusCode, 201);
    const createdItem = createRes.json();
    assert.equal(createdItem.publication_status, 'DRAFT');
    createdPortalIds.push(createdItem.id);

    // Verify audit log for create
    const auditCreate = await prisma.audit_logs.findFirst({
      where: {
        entity_id: createdItem.id,
        action: 'PORTAL_CONTENT_CREATE'
      }
    });
    assert.ok(auditCreate, 'PORTAL_CONTENT_CREATE audit log should exist');

    // 5. Public isolation: DRAFT item must NOT appear on public endpoint
    const publicBeforePublish = await app.inject({ method: 'GET', url: '/public/portal' });
    assert.equal(publicBeforePublish.statusCode, 200);
    const publicBeforeJson = publicBeforePublish.json();
    assert.equal(
      publicBeforeJson.items.some((i: { id: string }) => i.id === createdItem.id),
      false,
      'DRAFT portal item must not appear in public response'
    );

    // 6. Admin: update portal item
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/admin/content/portal/${createdItem.id}`,
      headers: adminHeaders,
      payload: {
        summary: 'Ringkasan jawaban terupdate'
      }
    });
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.json().summary, 'Ringkasan jawaban terupdate');

    // Verify audit log for update
    const auditUpdate = await prisma.audit_logs.findFirst({
      where: {
        entity_id: createdItem.id,
        action: 'PORTAL_CONTENT_UPDATE'
      }
    });
    assert.ok(auditUpdate, 'PORTAL_CONTENT_UPDATE audit log should exist');

    // 7. Admin: publish portal item
    const publishRes = await app.inject({
      method: 'PUT',
      url: `/admin/content/portal/${createdItem.id}/status`,
      headers: adminHeaders,
      payload: { status: 'PUBLISHED' }
    });
    assert.equal(publishRes.statusCode, 200);
    assert.equal(publishRes.json().publication_status, 'PUBLISHED');

    // Verify audit log for publish
    const auditPublish = await prisma.audit_logs.findFirst({
      where: {
        entity_id: createdItem.id,
        action: 'PORTAL_CONTENT_PUBLISH'
      }
    });
    assert.ok(auditPublish, 'PORTAL_CONTENT_PUBLISH audit log should exist');

    // 8. Public verification: PUBLISHED item appears in public response
    const publicAfterPublish = await app.inject({ method: 'GET', url: '/public/portal' });
    assert.equal(publicAfterPublish.statusCode, 200);
    const publicAfterJson = publicAfterPublish.json();
    const publishedFound = publicAfterJson.items.find((i: { id: string }) => i.id === createdItem.id);
    assert.ok(publishedFound, 'PUBLISHED item must appear in public response');
    assert.equal('created_by' in publishedFound, false, 'Internal actor IDs must not be exposed');
    assert.equal('updated_by' in publishedFound, false);

    // 9. Admin: reorder items in a section
    const reorderRes = await app.inject({
      method: 'PUT',
      url: '/admin/content/portal/reorder',
      headers: adminHeaders,
      payload: {
        section: 'faq',
        items: [
          { id: createdItem.id, display_order: 1 }
        ]
      }
    });
    assert.equal(reorderRes.statusCode, 200);

    const auditReorder = await prisma.audit_logs.findFirst({
      where: {
        action: 'PORTAL_CONTENT_REORDER',
        actor_user_id: adminId
      }
    });
    assert.ok(auditReorder, 'PORTAL_CONTENT_REORDER audit log should exist');

    // 10. Admin: archive portal item
    const archiveRes = await app.inject({
      method: 'DELETE',
      url: `/admin/content/portal/${createdItem.id}`,
      headers: adminHeaders
    });
    assert.equal(archiveRes.statusCode, 200);
    assert.equal(archiveRes.json().publication_status, 'ARCHIVED');

    const auditArchive = await prisma.audit_logs.findFirst({
      where: {
        entity_id: createdItem.id,
        action: 'PORTAL_CONTENT_ARCHIVE'
      }
    });
    assert.ok(auditArchive, 'PORTAL_CONTENT_ARCHIVE audit log should exist');

    // 11. Public isolation: ARCHIVED item must NOT appear in public response
    const publicAfterArchive = await app.inject({ method: 'GET', url: '/public/portal' });
    assert.equal(publicAfterArchive.statusCode, 200);
    assert.equal(
      publicAfterArchive.json().items.some((i: { id: string }) => i.id === createdItem.id),
      false,
      'ARCHIVED portal item must not appear in public response'
    );

    // 12. Regression check: existing public articles and videos still work
    const articlesRes = await app.inject({ method: 'GET', url: '/public/articles' });
    assert.equal(articlesRes.statusCode, 200);
    const videosRes = await app.inject({ method: 'GET', url: '/public/videos' });
    assert.equal(videosRes.statusCode, 200);
  } finally {
    if (createdPortalIds.length > 0) {
      await prisma.portal_contents.deleteMany({ where: { id: { in: createdPortalIds } } });
    }
    await prisma.audit_logs.deleteMany({ where: { actor_user_id: { in: [adminId, patientId] } } });
    await prisma.refresh_tokens.deleteMany({ where: { user_id: { in: [adminId, patientId] } } });
    await prisma.users.deleteMany({ where: { id: { in: [adminId, patientId] } } });
    await app.close();
    await prisma.$disconnect();
  }
});
