import '../src/config/env';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export const DEPENDENCY_ORDERED_MIGRATIONS: string[] = [
  '20251215061427_init',
  '20251215103331_add_password_hash_to_users',
  '20251224090727_add_chat_messages',
  '20260109065923_add_close_request_fields',
  '20260109072811_add_closed_reason',
  '20260109090736_phase8_safety_consent_audit',
  '20260804090000_link_chat_messages_voice_notes',
  '20260805090000_anonymous_accounts',
  '20260805120000_stage2_public_information',
  '20260805180000_stage3_health_planning',
  '20260805034119_stage4_counselor_complaints',
  '20260805183000_stage3_notification_public_id',
  '20260805220000_unify_consultations_ayo_curhat',
  '20260810102000_counselor_application_workflow',
  '20260810104500_backfill_existing_counselor_applications',
  '20260810120000_superadmin_account_management',
  '20260812090000_professional_service_roles',
  '20260815100000_portal_contents',
  '20260816090000_patient_companion_assignments',
  '20260817090000_companion_aware_routing',
  '20260818090000_hiv_care_monitoring',
  '20260819090000_art_care_plan_adherence',
  '20260820090000_art_side_effect_stock_refill_support',
  '20260821090000_care_signals_follow_up_escalation',
  '20260822090000_confidential_referral_service_navigation'
];

interface DatabaseState {
  hasMigrationsTable: boolean;
  appliedMigrationsCount: number;
  userTables: string[];
}

export async function inspectDatabaseState(prisma: PrismaClient): Promise<DatabaseState> {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema();`
  );
  const tableNames = tables.map((t) => t.tablename);
  const hasMigrationsTable = tableNames.includes('_prisma_migrations');
  const userTables = tableNames.filter((t) => t !== '_prisma_migrations');

  let appliedMigrationsCount = 0;
  if (hasMigrationsTable) {
    const countResult = await prisma.$queryRawUnsafe<{ count: number | string | bigint }[]>(
      `SELECT COUNT(*)::int as count FROM "_prisma_migrations";`
    );
    appliedMigrationsCount = Number(countResult[0]?.count ?? 0);
  }

  return {
    hasMigrationsTable,
    appliedMigrationsCount,
    userTables
  };
}

export function runCommand(command: string, cwd: string, customEnv?: NodeJS.ProcessEnv): string {
  const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/sh';
  return execSync(command, {
    cwd,
    env: { ...process.env, ...customEnv },
    shell,
    encoding: 'utf-8',
    stdio: 'pipe'
  });
}

export async function deployDatabase(customEnv?: NodeJS.ProcessEnv): Promise<{ mode: 'EXISTING' | 'FRESH'; appliedCount: number }> {
  const apiDir = path.resolve(__dirname, '..');
  const schemaPath = path.resolve(__dirname, 'schema.prisma');
  const migrationsDir = path.resolve(__dirname, 'migrations');

  const prisma = new PrismaClient({
    datasources: customEnv?.DATABASE_URL ? { db: { url: customEnv.DATABASE_URL } } : undefined
  });

  let state: DatabaseState;
  try {
    state = await inspectDatabaseState(prisma);
  } finally {
    await prisma.$disconnect();
  }

  const { hasMigrationsTable, appliedMigrationsCount, userTables } = state;

  if (hasMigrationsTable && appliedMigrationsCount > 0) {
    // Mode: EXISTING DATABASE
    console.log(`[db:deploy] Existing database detected with ${appliedMigrationsCount} recorded migration(s).`);
    console.log('[db:deploy] Running standard safe migration deployment (prisma migrate deploy)...');

    const output = runCommand(`npx prisma migrate deploy --schema "${schemaPath}"`, apiDir, customEnv);
    console.log(output.trim());
    return { mode: 'EXISTING', appliedCount: appliedMigrationsCount };
  }

  // Safety Gate: Database has user tables, but no migration history
  if (userTables.length > 0) {
    throw new Error(
      `[db:deploy] Safety gate error: Database schema contains ${userTables.length} existing user table(s) (${userTables.slice(0, 5).join(', ')}...), ` +
      `but no Prisma migration history was found. Aborting bootstrap to prevent schema corruption or data loss.`
    );
  }

  // Mode: FRESH DATABASE
  console.log('[db:deploy] Fresh database detected (clean schema with 0 existing user tables).');
  console.log('[db:deploy] Bootstrapping migrations in dependency-safe order...');

  // Verify that all dependency-ordered migrations exist on disk
  for (const migration of DEPENDENCY_ORDERED_MIGRATIONS) {
    const migrationSqlPath = path.join(migrationsDir, migration, 'migration.sql');
    if (!fs.existsSync(migrationSqlPath)) {
      throw new Error(`[db:deploy] Required migration SQL file missing: ${migrationSqlPath}`);
    }
  }

  // Detect any additional migrations created beyond the curated list
  const allMigrationDirs = fs
    .readdirSync(migrationsDir)
    .filter((entry) => {
      const fullPath = path.join(migrationsDir, entry);
      return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, 'migration.sql'));
    });

  const additionalMigrations = allMigrationDirs
    .filter((dir) => !DEPENDENCY_ORDERED_MIGRATIONS.includes(dir))
    .sort();

  const migrationsToApply = [...DEPENDENCY_ORDERED_MIGRATIONS, ...additionalMigrations];

  console.log(`[db:deploy] Total migrations to apply: ${migrationsToApply.length}`);

  for (let i = 0; i < migrationsToApply.length; i++) {
    const migration = migrationsToApply[i];
    const migrationSqlPath = path.join(migrationsDir, migration, 'migration.sql');

    console.log(`[db:deploy] [${i + 1}/${migrationsToApply.length}] Applying ${migration}...`);

    runCommand(
      `npx prisma db execute --file "${migrationSqlPath}" --schema "${schemaPath}"`,
      apiDir,
      customEnv
    );

    runCommand(
      `npx prisma migrate resolve --applied "${migration}" --schema "${schemaPath}"`,
      apiDir,
      customEnv
    );
  }

  console.log('[db:deploy] Validating migration status...');
  const statusOutput = runCommand(`npx prisma migrate status --schema "${schemaPath}"`, apiDir, customEnv);
  console.log(statusOutput.trim());

  if (!statusOutput.includes('Database schema is up to date')) {
    throw new Error(`[db:deploy] Migration verification failed. Output:\n${statusOutput}`);
  }

  console.log(`[db:deploy] Fresh bootstrap successfully completed! All ${migrationsToApply.length} migrations recorded.`);
  return { mode: 'FRESH', appliedCount: migrationsToApply.length };
}

if (require.main === module) {
  deployDatabase()
    .then(() => {
      console.log('[db:deploy] Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
