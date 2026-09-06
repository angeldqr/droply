-- CreateEnum
CREATE TYPE "habit_plan_status" AS ENUM ('ACTIVE', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "habit_answer" AS ENUM ('DONE', 'HALF', 'MISSED');

-- CreateTable
CREATE TABLE "habit_plans" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "start_on" DATE NOT NULL,
    "end_on" DATE NOT NULL,
    "status" "habit_plan_status" NOT NULL DEFAULT 'ACTIVE',
    "scored_through" DATE,
    "closed_at" TIMESTAMP(3),
    "report_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_plan_libraries" (
    "plan_id" UUID NOT NULL,
    "library_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "habit_plan_libraries_pkey" PRIMARY KEY ("plan_id","library_id")
);

-- CreateTable
CREATE TABLE "habit_responses" (
    "delivery_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "library_id" UUID NOT NULL,
    "answer" "habit_answer" NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habit_responses_pkey" PRIMARY KEY ("delivery_id")
);

-- CreateTable
CREATE TABLE "habit_day_scores" (
    "plan_id" UUID NOT NULL,
    "library_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "sent" INTEGER NOT NULL,
    "answered" INTEGER NOT NULL,
    "earned" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "habit_day_scores_pkey" PRIMARY KEY ("plan_id","library_id","day")
);

-- CreateIndex
CREATE INDEX "habit_plans_owner_id_status_idx" ON "habit_plans"("owner_id", "status");

-- CreateIndex
CREATE INDEX "habit_plans_status_scored_through_idx" ON "habit_plans"("status", "scored_through");

-- CreateIndex
CREATE INDEX "habit_plan_libraries_library_id_active_idx" ON "habit_plan_libraries"("library_id", "active");

-- CreateIndex
CREATE INDEX "habit_responses_plan_id_library_id_idx" ON "habit_responses"("plan_id", "library_id");

-- AddForeignKey
ALTER TABLE "habit_plans" ADD CONSTRAINT "habit_plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_plans" ADD CONSTRAINT "habit_plans_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_plan_libraries" ADD CONSTRAINT "habit_plan_libraries_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "habit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_day_scores" ADD CONSTRAINT "habit_day_scores_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "habit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Una biblioteca solo puede estar en un plan vivo a la vez.
--
-- Prisma no sabe declarar indices parciales, asi que este va escrito a mano y
-- no se puede quitar del esquema: es lo que hace cumplir de verdad que anular
-- un plan "libere" sus bibliotecas. Sin el, la comprobacion del caso de uso la
-- podrian pasar dos peticiones a la vez y el mismo envio saldria con dos juegos
-- de botones, sin saber a que plan pertenece la respuesta.
CREATE UNIQUE INDEX "habit_plan_libraries_una_activa"
  ON "habit_plan_libraries" ("library_id")
  WHERE "active";
