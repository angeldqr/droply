-- La meta de cada hábito: cuántas anotaciones al día y en qué días de la semana.
-- Los que ya existen quedan en una vez, todos los días.
ALTER TABLE "habits"
  ADD COLUMN "daily_target" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "active_days" INTEGER NOT NULL DEFAULT 127,
  ADD CONSTRAINT "habits_daily_target_check" CHECK ("daily_target" BETWEEN 1 AND 10),
  ADD CONSTRAINT "habits_active_days_check" CHECK ("active_days" BETWEEN 1 AND 127);
