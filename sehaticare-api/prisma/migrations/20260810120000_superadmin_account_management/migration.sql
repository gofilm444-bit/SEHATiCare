-- Additive privilege capability. The existing ADMIN role remains compatible with all routes.
ALTER TABLE "users"
ADD COLUMN "is_superadmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "users"
ADD CONSTRAINT "users_superadmin_requires_admin_role"
CHECK (NOT "is_superadmin" OR "role" = 'ADMIN');

CREATE INDEX "users_is_superadmin_is_active_idx"
ON "users"("is_superadmin", "is_active");
