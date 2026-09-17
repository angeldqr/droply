-- Tramos en pausa de cada hábito: esos días no cuentan como fallo.
CREATE TABLE "habit_pauses" (
    "id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE,

    CONSTRAINT "habit_pauses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "habit_pauses_en_orden" CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on")
);

CREATE INDEX "habit_pauses_habit_id_idx" ON "habit_pauses"("habit_id");

-- Una sola pausa abierta por hábito.
CREATE UNIQUE INDEX "habit_pauses_una_abierta"
  ON "habit_pauses"("habit_id")
  WHERE "ends_on" IS NULL;

ALTER TABLE "habit_pauses" ADD CONSTRAINT "habit_pauses_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
