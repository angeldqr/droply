/*
 * Deja el almacenamiento levantado antes de que arranque el API.
 *
 * En desarrollo MinIO corre nativo (Docker no se usa acá, solo para el
 * despliegue), y tener que acordarse de lanzarlo a mano en una tercera terminal
 * era la parte del arranque que siempre se olvidaba: la aplicación quedaba
 * entera menos las vistas previas, sin decir por qué. Ahora cuelga del `dev`
 * del API: se lanza suelto, sobrevive a los reinicios del watcher y no hace
 * falta volver a tocarlo hasta reiniciar la máquina.
 *
 * Si algo falla no se detiene el arranque: el API sirve identidad y bibliotecas
 * sin almacenamiento, y un aviso claro vale más que no poder trabajar.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = readEnv(join(root, '.env'));

/** MinIO escucha en IPv4; Node resuelve `localhost` a ::1 primero. */
const endpoint = (env.STORAGE_ENDPOINT ?? 'http://127.0.0.1:9000').replace(
  'localhost',
  '127.0.0.1',
);

await main();

async function main() {
  if (await isLive()) {
    console.log(`[almacenamiento] ya estaba en pie en ${endpoint}`);
    await ensureBucket();
    return;
  }

  const binary = findBinary();

  if (!binary) {
    console.warn(
      [
        '[almacenamiento] no encontré el binario de MinIO, así que las vistas previas y las',
        '  subidas no van a funcionar. Descárgalo y déjalo en una de estas rutas, o apunta a',
        '  él con MINIO_BINARY en el .env:',
        `    ${join(root, '.tools', binaryName())}`,
        `    ${join(homeDir(), 'minio', binaryName())}`,
        '  https://dl.min.io/server/minio/release/windows-amd64/minio.exe',
      ].join('\n'),
    );
    return;
  }

  const dataDir = join(dirname(binary), 'data');
  mkdirSync(dataDir, { recursive: true });

  /*
   * Suelto y sin heredar la consola: si colgara del proceso del API, cada
   * reinicio del watcher se lo llevaría por delante y habría que esperar a que
   * volviera a levantar.
   */
  const child = spawn(binary, ['server', dataDir, '--console-address', ':9001'], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      MINIO_ROOT_USER: env.STORAGE_ACCESS_KEY ?? '',
      MINIO_ROOT_PASSWORD: env.STORAGE_SECRET_KEY ?? '',
    },
  });

  child.unref();

  if (!(await waitUntilLive())) {
    console.warn('[almacenamiento] MinIO no respondió a tiempo; sigo sin él.');
    return;
  }

  console.log(`[almacenamiento] MinIO en pie en ${endpoint}`);
  await ensureBucket();
}

function binaryName() {
  return process.platform === 'win32' ? 'minio.exe' : 'minio';
}

function homeDir() {
  return process.env.USERPROFILE ?? process.env.HOME ?? root;
}

function findBinary() {
  const candidates = [
    env.MINIO_BINARY,
    process.env.MINIO_BINARY,
    join(root, '.tools', binaryName()),
    join(homeDir(), 'minio', binaryName()),
  ];

  return candidates.find((path) => path && existsSync(path)) ?? null;
}

async function isLive() {
  try {
    const response = await fetch(`${endpoint}/minio/health/live`, {
      signal: AbortSignal.timeout(1500),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntilLive() {
  // Arrancar en frío le lleva un segundo largo; treinta intentos son de sobra.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await isLive()) return true;

    await new Promise((done) => setTimeout(done, 500));
  }

  return false;
}

/** Un bucket que no existe rompe la primera subida y no antes: mejor ahora. */
async function ensureBucket() {
  const bucket = env.STORAGE_BUCKET;
  if (!bucket) return;

  try {
    const require = createRequire(join(root, 'apps', 'api', 'package.json'));
    const { S3Client, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');

    const client = new S3Client({
      endpoint,
      region: env.STORAGE_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY ?? '',
        secretAccessKey: env.STORAGE_SECRET_KEY ?? '',
      },
      forcePathStyle: true,
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`[almacenamiento] bucket ${bucket} creado`);
    }
  } catch (caught) {
    console.warn(`[almacenamiento] no pude comprobar el bucket: ${caught.message}`);
  }
}

/** El `.env` de la raíz, sin traer una dependencia para leer pares clave=valor. */
function readEnv(path) {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
      .map((line) => {
        const at = line.indexOf('=');

        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );
}
