const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

/**
 * El token de acceso vive en memoria del módulo, no en `localStorage`.
 *
 * Cualquier script de la página puede leer el almacenamiento del navegador, y
 * un token guardado ahí sobrevive a recargas y pestañas. En memoria muere con
 * la pestaña, y lo que permite recuperarlo es la cookie `httpOnly` de refresco,
 * que el JavaScript de la página no puede tocar.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Marca que esta llamada ya es el reintento, para no encadenar otro. */
  retryOnExpired?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);

  /*
   * Un 401 con la sesión vencida se resuelve solo: se pide un token nuevo con
   * la cookie de refresco y se reintenta una vez. Si el refresco también falla,
   * ahí sí es una sesión terminada de verdad.
   */
  if (response.status === 401 && options.retryOnExpired !== false && path !== '/auth/refresh') {
    const renewed = await renew();

    if (renewed) return api<T>(path, { ...options, retryOnExpired: false });
  }

  if (!response.ok) throw await toError(response);

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function send(path: string, options: RequestOptions): Promise<Response> {
  return fetch(`${API_URL}/api${path}`, {
    method: options.method ?? 'GET',
    // Sin esto la cookie de refresco no viaja y la sesión se pierde al recargar.
    credentials: 'include',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
}

/**
 * El refresco en vuelo, compartido por todas las peticiones que lo necesiten.
 *
 * Sin esto, dos llamadas que reciben 401 a la vez piden dos refrescos con la
 * misma cookie. El servidor rota el token en el primero y ve el segundo como un
 * token ya canjeado, o sea un reuso, y por diseño revoca la familia entera: el
 * usuario queda afuera por haber tenido dos pestañas cargando.
 */
let renewal: Promise<boolean> | null = null;

/** Se avisa cuando la sesión se termina de verdad, para no dejar la interfaz
 *  mostrando a un usuario que ya no existe. */
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

function renew(): Promise<boolean> {
  renewal ??= (async () => {
    try {
      const response = await send('/auth/refresh', { method: 'POST' });

      if (!response.ok) {
        accessToken = null;
        onSessionLost?.();

        return false;
      }

      const session = (await response.json()) as { accessToken: string };
      accessToken = session.accessToken;

      return true;
    } catch {
      return false;
    } finally {
      renewal = null;
    }
  })();

  return renewal;
}

async function toError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      code?: string;
      message?: string;
      details?: { fields?: Record<string, string> };
    };

    return new ApiError(
      response.status,
      body.code ?? 'unknown',
      body.message ?? 'Algo salió mal.',
      body.details?.fields ?? {},
    );
  } catch {
    // El servidor no respondió JSON: se cayó, o hay un proxy en el medio.
    return new ApiError(response.status, 'unreachable', 'No pudimos hablar con el servidor.');
  }
}
