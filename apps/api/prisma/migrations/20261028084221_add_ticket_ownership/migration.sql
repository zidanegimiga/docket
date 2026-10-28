-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "created_by_id" UUID;

-- CreateIndex
CREATE INDEX "tickets_created_by_id_idx" ON "tickets"("created_by_id");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
