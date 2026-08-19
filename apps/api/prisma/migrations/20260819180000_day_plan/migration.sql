-- "Veces al dia" pasa a significar lo que dice: cada elemento sale ese numero
-- de veces, cada envio en su propio momento de la franja. Con el reparto
-- asignado ya no hay nada que elegir en cada disparo, asi que la estrategia de
-- seleccion y la bolsa del "sin repetir" se quedan sin trabajo.
DROP TABLE "sent_items";

ALTER TABLE "schedules" DROP COLUMN "strategy";

DROP TYPE "selection_strategy";
