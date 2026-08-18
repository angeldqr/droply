-- CreateEnum
CREATE TYPE "recipient_channel" AS ENUM ('TELEGRAM');

-- CreateTable
CREATE TABLE "recipients" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "channel" "recipient_channel" NOT NULL DEFAULT 'TELEGRAM',
    "external_id" TEXT,
    "link_code_hash" TEXT,
    "link_code_expires_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipients_link_code_hash_key" ON "recipients"("link_code_hash");

-- CreateIndex
CREATE INDEX "recipients_owner_id_idx" ON "recipients"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipients_owner_id_channel_external_id_key" ON "recipients"("owner_id", "channel", "external_id");

-- AddForeignKey
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
