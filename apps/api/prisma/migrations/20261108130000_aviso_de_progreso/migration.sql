-- Avisos de progreso: cuántos al día pidió el plan y a qué hora salió el último.
ALTER TABLE "habit_plans"
  ADD COLUMN "progress_per_day" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "progress_sent_at" TIMESTAMP(3);

-- El mismo tope que el contrato; la base no acepta un plan que pida cien.
ALTER TABLE "habit_plans"
  ADD CONSTRAINT "habit_plans_avisos_en_rango" CHECK ("progress_per_day" BETWEEN 0 AND 6);
