-- Reintentos con espera creciente y avisos dentro de la aplicacion.
ALTER TYPE "delivery_status" ADD VALUE 'RETRYING';

ALTER TABLE "delivery_attempts" ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "delivery_attempts" ADD COLUMN "next_attempt_at" TIMESTAMP(3);

CREATE INDEX "delivery_attempts_status_next_attempt_at_idx"
    ON "delivery_attempts"("status", "next_attempt_at");

CREATE TABLE "notices" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notices_owner_id_read_at_idx" ON "notices"("owner_id", "read_at");

ALTER TABLE "notices"
    ADD CONSTRAINT "notices_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
