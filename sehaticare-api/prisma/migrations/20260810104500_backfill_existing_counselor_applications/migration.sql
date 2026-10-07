-- Idempotent compatibility backfill for counselor profiles that predate self-application.
-- No existing row is updated or deleted.
INSERT INTO "counselor_applications" (
  "id", "user_id", "status", "professional_name", "profession", "facility_id", "region_id",
  "competencies", "languages", "active_days", "opens_at", "closes_at", "timezone",
  "max_active_conversations", "submitted_at", "reviewed_at", "verified_at", "activated_at",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), cp."user_id",
  CASE WHEN cp."verification_status" = 'VERIFIED' AND cp."permission_enabled" AND cp."is_active"
    THEN 'ACTIVE'::"counselor_application_status" ELSE 'DRAFT'::"counselor_application_status" END,
  cp."professional_name", cp."profession", cp."facility_id", cp."region_id", cp."competencies",
  cp."languages", cp."active_days", cp."opens_at", cp."closes_at", cp."timezone",
  cp."max_active_conversations", cp."created_at",
  CASE WHEN cp."verification_status" = 'VERIFIED' THEN COALESCE(cp."verified_at", cp."updated_at") ELSE NULL END,
  CASE WHEN cp."verification_status" = 'VERIFIED' THEN COALESCE(cp."verified_at", cp."updated_at") ELSE NULL END,
  CASE WHEN cp."verification_status" = 'VERIFIED' AND cp."permission_enabled" AND cp."is_active" THEN cp."updated_at" ELSE NULL END,
  cp."created_at", cp."updated_at"
FROM "counselor_profiles" cp
WHERE NOT EXISTS (SELECT 1 FROM "counselor_applications" ca WHERE ca."user_id" = cp."user_id");

INSERT INTO "counselor_status_history" ("id", "application_id", "changed_by", "from_status", "to_status", "reason", "created_at")
SELECT gen_random_uuid(), ca."id", COALESCE(cp."verified_by", cp."user_id"), NULL, ca."status", 'LEGACY_PROFILE_BACKFILL', CURRENT_TIMESTAMP
FROM "counselor_applications" ca
JOIN "counselor_profiles" cp ON cp."user_id" = ca."user_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "counselor_status_history" csh
  WHERE csh."application_id" = ca."id" AND csh."reason" = 'LEGACY_PROFILE_BACKFILL'
);

INSERT INTO "counselor_review_events" ("id", "application_id", "actor_user_id", "action", "reason", "created_at")
SELECT gen_random_uuid(), ca."id", COALESCE(cp."verified_by", cp."user_id"), 'LEGACY_PROFILE_BACKFILL', 'Profil aktif sebelum workflow aplikasi', CURRENT_TIMESTAMP
FROM "counselor_applications" ca
JOIN "counselor_profiles" cp ON cp."user_id" = ca."user_id"
WHERE NOT EXISTS (
  SELECT 1 FROM "counselor_review_events" cre
  WHERE cre."application_id" = ca."id" AND cre."action" = 'LEGACY_PROFILE_BACKFILL'
);
