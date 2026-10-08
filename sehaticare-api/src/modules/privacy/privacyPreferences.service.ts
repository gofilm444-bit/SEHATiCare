import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { audit } from '../../utils/auditEvents';
import type { user_role } from '@prisma/client';
import type { PrivacyPreferencesPatchInput } from './privacyPreferences.validators';

export interface PrivacyPreferencesDto {
  lock_on_background: boolean;
  auto_lock_minutes: number | null;
  require_reauth_to_unlock: boolean;
  discreet_page_titles: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPrivacyPreferences(userId: string): Promise<PrivacyPreferencesDto> {
  const existing = await prisma.user_privacy_preferences.findUnique({
    where: { user_id: userId }
  });

  if (existing) {
    return {
      lock_on_background: existing.lock_on_background,
      auto_lock_minutes: existing.auto_lock_minutes,
      require_reauth_to_unlock: existing.require_reauth_to_unlock,
      discreet_page_titles: existing.discreet_page_titles,
      created_at: existing.created_at.toISOString(),
      updated_at: existing.updated_at.toISOString()
    };
  }

  // Create default preferences
  const created = await prisma.user_privacy_preferences.create({
    data: {
      id: randomUUID(),
      user_id: userId,
      lock_on_background: true,
      auto_lock_minutes: 5,
      require_reauth_to_unlock: false,
      discreet_page_titles: true
    }
  });

  return {
    lock_on_background: created.lock_on_background,
    auto_lock_minutes: created.auto_lock_minutes,
    require_reauth_to_unlock: created.require_reauth_to_unlock,
    discreet_page_titles: created.discreet_page_titles,
    created_at: created.created_at.toISOString(),
    updated_at: created.updated_at.toISOString()
  };
}

export async function updatePrivacyPreferences(
  userId: string,
  userRole: user_role | null,
  patch: PrivacyPreferencesPatchInput
): Promise<PrivacyPreferencesDto> {
  const dataToUpdate: {
    lock_on_background?: boolean;
    auto_lock_minutes?: number | null;
    require_reauth_to_unlock?: boolean;
    discreet_page_titles?: boolean;
  } = {};

  if (patch.lock_on_background !== undefined) {
    dataToUpdate.lock_on_background = patch.lock_on_background;
  }
  if (patch.auto_lock_minutes !== undefined) {
    dataToUpdate.auto_lock_minutes = patch.auto_lock_minutes;
  }
  if (patch.require_reauth_to_unlock !== undefined) {
    dataToUpdate.require_reauth_to_unlock = patch.require_reauth_to_unlock;
  }
  if (patch.discreet_page_titles !== undefined) {
    dataToUpdate.discreet_page_titles = patch.discreet_page_titles;
  }

  const upserted = await prisma.user_privacy_preferences.upsert({
    where: { user_id: userId },
    update: dataToUpdate,
    create: {
      id: randomUUID(),
      user_id: userId,
      lock_on_background: patch.lock_on_background ?? true,
      auto_lock_minutes: patch.auto_lock_minutes !== undefined ? patch.auto_lock_minutes : 5,
      require_reauth_to_unlock: patch.require_reauth_to_unlock ?? false,
      discreet_page_titles: patch.discreet_page_titles ?? true
    }
  });

  await audit.log(prisma, {
    actorUserId: userId,
    actorRole: userRole,
    action: 'PRIVACY_PREFERENCE_UPDATED',
    meta: {
      changed_fields: Object.keys(dataToUpdate),
      lock_on_background: upserted.lock_on_background,
      auto_lock_minutes: upserted.auto_lock_minutes,
      require_reauth_to_unlock: upserted.require_reauth_to_unlock,
      discreet_page_titles: upserted.discreet_page_titles
    }
  });

  return {
    lock_on_background: upserted.lock_on_background,
    auto_lock_minutes: upserted.auto_lock_minutes,
    require_reauth_to_unlock: upserted.require_reauth_to_unlock,
    discreet_page_titles: upserted.discreet_page_titles,
    created_at: upserted.created_at.toISOString(),
    updated_at: upserted.updated_at.toISOString()
  };
}
