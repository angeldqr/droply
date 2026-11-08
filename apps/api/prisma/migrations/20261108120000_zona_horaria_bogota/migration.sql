-- Las cuentas que quedaron en UTC pasan a Bogotá.
--
-- La cuenta de administración nacía con la zona del servidor, que en el
-- contenedor es UTC, y no había dónde cambiarla: la bitácora cortaba el día a
-- las siete de la noche de Colombia, y un sábado a las ocho ya era domingo.
-- Nadie eligió UTC a propósito; desde ahora se cambia en «Tu cuenta».
UPDATE "users" SET "timezone" = 'America/Bogota' WHERE "timezone" = 'UTC';
