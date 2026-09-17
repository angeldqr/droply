# Respaldos de producción

## Qué se guarda

Cada noche, a las **03:30** del servidor (`root@2.25.120.11`), `scripts/respaldo.sh` deja en
`/root/respaldos/`:

| Archivo | Qué es |
| --- | --- |
| `db-<fecha>.sql.gz` | Todo Postgres: cuentas, bibliotecas, horarios, envíos y la bitácora. |
| `fotos-<fecha>.tar.gz` | El volumen de MinIO: las fotos de la bitácora y los archivos de las bibliotecas. |
| `respaldo.log` | Una línea por corrida: `OK` con los tamaños, o el error. |

Se conservan los **14 días** de atrás y lo más viejo se borra solo. Los dos archivos se escriben
con un nombre temporal y solo al terminar toman el suyo, y un volcado incompleto se borra y hace
fallar la corrida: nunca queda un archivo a medias pareciendo un respaldo bueno.

**El respaldo vive en el mismo disco del servidor.** Sirve contra un borrado, una migración mala o
un despliegue equivocado; **no** contra perder el servidor. Llevarlo fuera (otro servidor o un
bucket) es el siguiente paso y necesita credenciales nuevas.

## Cómo está instalado

```sh
# El cron (crontab -e), una sola línea:
30 3 * * * sh /opt/reconectate/scripts/respaldo.sh
```

El script se actualiza solo con el `git pull` de cada despliegue.

Para correrlo a mano:

```sh
sh /opt/reconectate/scripts/respaldo.sh && tail -3 /root/respaldos/respaldo.log
```

## Cómo se restaura

Primero se para la API, para que nadie escriba mientras se restaura:

```sh
cd /opt/reconectate/infra
docker compose --env-file /opt/reconectate/.env -f compose.yml --profile apps stop api web
```

### La base

```sh
# Ojo: esto reemplaza la base entera por la del respaldo.
zcat /root/respaldos/db-<fecha>.sql.gz \
  | docker exec -i reconectate-postgres-1 psql -U reconectate -d postgres \
      -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS reconectate;' \
      -c 'CREATE DATABASE reconectate;'

zcat /root/respaldos/db-<fecha>.sql.gz \
  | docker exec -i reconectate-postgres-1 psql -U reconectate -d reconectate -v ON_ERROR_STOP=1
```

Para probar un respaldo **sin tocar producción**, se restaura en otra base:

```sh
docker exec -i reconectate-postgres-1 psql -U reconectate -d postgres -c 'CREATE DATABASE prueba;'
zcat /root/respaldos/db-<fecha>.sql.gz \
  | docker exec -i reconectate-postgres-1 psql -U reconectate -d prueba -v ON_ERROR_STOP=1
docker exec reconectate-postgres-1 psql -U reconectate -d prueba -tAc 'SELECT count(*) FROM habits;'
docker exec reconectate-postgres-1 psql -U reconectate -d postgres -c 'DROP DATABASE prueba;'
```

### Las fotos

```sh
docker compose --env-file /opt/reconectate/.env -f compose.yml stop minio

docker run --rm \
  -v reconectate_minio-data:/datos \
  -v /root/respaldos:/entrada:ro \
  alpine sh -c 'rm -rf /datos/* && tar xzf /entrada/fotos-<fecha>.tar.gz -C /datos'

docker compose --env-file /opt/reconectate/.env -f compose.yml start minio
```

### Volver a levantar

```sh
docker compose --env-file /opt/reconectate/.env -f compose.yml --profile apps up -d
docker logs reconectate-api-1 --tail 20
curl -s https://api.reconecta.cloud/health
```

Las fotos y sus filas van juntas: si se restaura una sola de las dos, quedan anotaciones con fotos
que ya no están (la pantalla lo dice: «Esta foto ya no está») o archivos que nadie referencia.
Restaurar las dos del **mismo** `<fecha>` evita las dos cosas.
