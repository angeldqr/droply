-- Los horarios dejan de expresarse con una regla RRULE y pasan a decirse como
-- los piensa el usuario: que dias de la semana, y entre que hora y que hora.
--
-- Los que ya existan se traen con los valores por defecto (todos los dias, de
-- 9:00 a 21:00) porque no hay forma fiable de traducir una RRULE arbitraria a
-- una franja, y son pocos: en produccion todavia no hay ninguno.
ALTER TABLE "schedules" ADD COLUMN "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7];
ALTER TABLE "schedules" ADD COLUMN "start_minute" INTEGER NOT NULL DEFAULT 540;
ALTER TABLE "schedules" ADD COLUMN "end_minute" INTEGER NOT NULL DEFAULT 1260;
ALTER TABLE "schedules" DROP COLUMN "rrule";

-- Los valores por defecto solo servian para rellenar las filas viejas.
ALTER TABLE "schedules" ALTER COLUMN "weekdays" DROP DEFAULT;
ALTER TABLE "schedules" ALTER COLUMN "start_minute" DROP DEFAULT;
ALTER TABLE "schedules" ALTER COLUMN "end_minute" DROP DEFAULT;
