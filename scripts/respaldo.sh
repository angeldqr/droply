#!/bin/sh
#
# El respaldo diario de producción: la base y las fotos.
#
# Vive en el repositorio y no suelto en el servidor porque es código que decide
# si mañana se puede recuperar la bitácora de alguien: se revisa y se versiona
# como el resto.
#
# Las fotos se copian del volumen con un contenedor de paso, sin instalar nada
# en el servidor y sin apagar MinIO: son objetos que ya están escritos, y el
# peor caso es que una foto subida en ese instante quede fuera del respaldo de
# hoy —entra en el de mañana—.
#
# Se corre solo por cron (ver docs/respaldos.md), y a mano cuando haga falta:
#   sh /opt/reconectate/scripts/respaldo.sh
set -eu

DESTINO=/root/respaldos
# Se borra lo que pase de estos días. `-mtime +13` es «más de trece días
# cumplidos», o sea que deja justo las dos semanas de atrás.
DIAS=13
VOLUMEN=reconectate_minio-data
CONTENEDOR=reconectate-postgres-1
BASE=reconectate

fecha="$(date +%Y%m%d-%H%M%S)"
db="$DESTINO/db-$fecha.sql.gz"
fotos="$DESTINO/fotos-$fecha.tar.gz"
registro="$DESTINO/respaldo.log"

mkdir -p "$DESTINO"

# Cualquier fallo se anota antes de salir: un respaldo que no existe tiene que
# notarse en el archivo donde se mira, no solo en el correo de cron.
anotar() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >>"$registro"
}

# Lo que quedó a medias se va con el intento: el respaldo de ayer sigue siendo
# el bueno hasta que este termine entero.
trap 'rm -f "$db.tmp" "$fotos.tmp"; anotar "ERROR: el respaldo no terminó"' EXIT

# Los dos archivos se escriben como `.tmp` y solo al final toman su nombre: uno
# cortado a la mitad —disco lleno, contenedor muerto— no puede quedar
# pareciendo un respaldo bueno, que es justo el que se restauraría.
docker exec "$CONTENEDOR" pg_dump -U "$BASE" "$BASE" | gzip >"$db.tmp"

# `set -e` no ve el fallo de pg_dump, que va al principio de la tubería: se
# comprueba que el volcado llegue hasta su última línea.
if ! zcat "$db.tmp" | tail -5 | grep -q 'PostgreSQL database dump complete'; then
  rm -f "$db.tmp"
  anotar "ERROR: el volcado de la base salió incompleto"
  trap - EXIT
  exit 1
fi

mv "$db.tmp" "$db"

docker run --rm \
  -v "$VOLUMEN":/datos:ro \
  -v "$DESTINO":/salida \
  alpine tar czf "/salida/$(basename "$fotos").tmp" -C /datos .

mv "$fotos.tmp" "$fotos"

# Lo viejo se borra al final: si algo falló arriba, el respaldo de ayer sigue.
find "$DESTINO" -maxdepth 1 -name 'db-*.sql.gz' -mtime "+$DIAS" -delete
find "$DESTINO" -maxdepth 1 -name 'fotos-*.tar.gz' -mtime "+$DIAS" -delete

trap - EXIT
anotar "OK base=$(du -h "$db" | cut -f1) fotos=$(du -h "$fotos" | cut -f1)"
