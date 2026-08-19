-- Cuantas veces al dia se manda cada elemento, repartidas dentro de la franja
-- del horario. Uno es lo de siempre, asi que las filas viejas no cambian.
ALTER TABLE "library_items" ADD COLUMN "times_per_day" INTEGER NOT NULL DEFAULT 1;
