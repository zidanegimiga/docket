-- System roles exist in every environment. They cannot be renamed or deleted through the API.
-- When a permission is added to the catalog, a migration must also grant it to admin; an
-- integration test fails until it does.

INSERT INTO "roles" ("id", "name", "description", "is_system", "updated_at") VALUES
  (gen_random_uuid(), 'admin', 'Full access, including approving users and managing roles', true, now()),
  (gen_random_uuid(), 'member', 'Works on tickets: view, create and update their own', true, now())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission")
SELECT "roles"."id", "grants"."permission"
FROM "roles"
JOIN (VALUES
  ('admin', 'tickets:read'),
  ('admin', 'tickets:create'),
  ('admin', 'tickets:update:own'),
  ('admin', 'tickets:update:any'),
  ('admin', 'users:read'),
  ('admin', 'users:manage'),
  ('admin', 'roles:manage'),
  ('admin', 'audit:read'),
  ('member', 'tickets:read'),
  ('member', 'tickets:create'),
  ('member', 'tickets:update:own')
) AS "grants" ("role", "permission") ON "grants"."role" = "roles"."name"
ON CONFLICT DO NOTHING;
