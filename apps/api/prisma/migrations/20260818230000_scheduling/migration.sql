-- CreateEnum
CREATE TYPE "selection_strategy" AS ENUM ('RANDOM', 'RANDOM_NO_REPEAT', 'SEQUENTIAL');

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "library_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "rrule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "strategy" "selection_strategy" NOT NULL DEFAULT 'RANDOM',
    "kind_filter" "item_kind",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sent_items" (
    "schedule_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_items_pkey" PRIMARY KEY ("schedule_id","item_id")
);

-- CreateIndex
CREATE INDEX "schedules_active_next_run_at_idx" ON "schedules"("active", "next_run_at");

-- CreateIndex
CREATE INDEX "schedules_owner_id_idx" ON "schedules"("owner_id");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sent_items" ADD CONSTRAINT "sent_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
