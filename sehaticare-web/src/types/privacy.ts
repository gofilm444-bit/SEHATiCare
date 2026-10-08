export interface PrivacyPreferences {
  lock_on_background: boolean;
  auto_lock_minutes: number | null;
  require_reauth_to_unlock: boolean;
  discreet_page_titles: boolean;
  created_at: string;
  updated_at: string;
}

export type PrivacyPreferencesPatch = Partial<Omit<PrivacyPreferences, 'created_at' | 'updated_at'>>;
