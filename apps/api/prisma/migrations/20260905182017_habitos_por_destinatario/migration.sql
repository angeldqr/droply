-- DropIndex
DROP INDEX "habit_plan_libraries_library_id_active_idx";

-- AlterTable
--
-- Se agrega nula, se rellena desde el plan y recien despues se exige. Puesta
-- NOT NULL de una vez, la migracion solo correria contra una tabla vacia.
ALTER TABLE "habit_plan_libraries" ADD COLUMN "recipient_id" UUID;

UPDATE "habit_plan_libraries" AS l
   SET "recipient_id" = p."recipient_id"
  FROM "habit_plans" AS p
 WHERE p."id" = l."plan_id";

ALTER TABLE "habit_plan_libraries" ALTER COLUMN "recipient_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "habit_plan_libraries_library_id_recipient_id_active_idx" ON "habit_plan_libraries"("library_id", "recipient_id", "active");


-- El indice unico parcial vuelve, ahora sobre la pareja.
--
-- La misma biblioteca puede estar en dos planes vivos mientras vayan a personas
-- distintas: son horarios distintos y envios distintos, asi que ninguna
-- respuesta queda ambigua. Lo que se impide es que este dos veces hacia la
-- misma persona, porque ese envio llegaria con dos juegos de botones.
DROP INDEX IF EXISTS "habit_plan_libraries_una_activa";

CREATE UNIQUE INDEX "habit_plan_libraries_una_activa_por_destinatario"
  ON "habit_plan_libraries" ("library_id", "recipient_id")
  WHERE "active";
