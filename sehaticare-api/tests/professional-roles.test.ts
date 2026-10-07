import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('professional role migration is additive and introduces isolated outreach storage', () => {
  const sql = readFileSync(resolve(__dirname, '../prisma/migrations/20260812090000_professional_service_roles/migration.sql'), 'utf8');
  assert.doesNotMatch(sql, /DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
  assert.match(sql, /CREATE TYPE "professional_service_role"/);
  assert.match(sql, /CREATE TABLE "professional_outreach_cases"/);
  assert.match(sql, /ADD COLUMN\s+"service_role"/);
});

test('server authorization separates companion queue and outreach conversation access', () => {
  const counselorRoutes = readFileSync(resolve(__dirname, '../src/modules/stage4/counselor.routes.ts'), 'utf8');
  const professionalRoutes = readFileSync(resolve(__dirname, '../src/modules/stage4/professionalRoles.routes.ts'), 'utf8');
  const matching = readFileSync(resolve(__dirname, '../src/modules/stage4/counselorMatching.service.ts'), 'utf8');
  assert.match(counselorRoutes, /\['COUNSELOR','FACILITATOR'\]\.includes/);
  assert.match(counselorRoutes, /service_role==='OUTREACH_WORKER'/);
  assert.match(counselorRoutes, /app\.get\('\/counselor\/queue'/);
  assert.match(professionalRoutes, /requireProfessional\(req, reply, 'COMPANION'\)/);
  assert.match(professionalRoutes, /requireProfessional\(req, reply, 'OUTREACH_WORKER'\)/);
  assert.match(professionalRoutes, /created_by: req\.user!\.userId/);
  assert.match(matching, /service_role: \{ in: \['COUNSELOR', 'FACILITATOR'\] \}/);
});

test('outreach validation blocks common direct identifiers and audit metadata excludes case text', () => {
  const source = readFileSync(resolve(__dirname, '../src/modules/stage4/professionalRoles.routes.ts'), 'utf8');
  assert.match(source, /Jangan masukkan alamat email/);
  assert.match(source, /Jangan masukkan nomor telepon/);
  assert.doesNotMatch(source, /meta:\s*\{[^}]*summary/s);
  assert.doesNotMatch(source, /meta:\s*\{[^}]*referral_note/s);
});
