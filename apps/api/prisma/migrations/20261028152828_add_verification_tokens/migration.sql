-- CreateEnum
CREATE TYPE "verification_purpose" AS ENUM ('email_verification');

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "verification_purpose" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_hash_key" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "verification_tokens_user_id_purpose_idx" ON "verification_tokens"("user_id", "purpose");

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Only the hex SHA-256 of a token is stored, never the token itself.
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_token_hash_format_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_expiry_check" CHECK ("expires_at" > "created_at");
