-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "delivery_attempts" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "item_id" UUID,
    "occurrence_key" TEXT NOT NULL,
    "status" "delivery_status" NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_attempts_occurrence_key_key" ON "delivery_attempts"("occurrence_key");

-- CreateIndex
CREATE INDEX "delivery_attempts_schedule_id_occurred_at_idx" ON "delivery_attempts"("schedule_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
