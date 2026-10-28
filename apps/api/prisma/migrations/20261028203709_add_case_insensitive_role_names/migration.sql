-- Role names are unique regardless of case, so "Support" and "support" cannot both exist.
-- Prisma cannot express an expression index, so this one is written by hand.
CREATE UNIQUE INDEX "roles_name_lower_key" ON "roles" (lower("name"));
