-- El nombre con el que firma cada horario. Nulo = el nombre de la cuenta.
ALTER TABLE "schedules" ADD COLUMN "sender_name" TEXT;
