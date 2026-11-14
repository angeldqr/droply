import type { SessionResponse } from '@reconectate/contracts';
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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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
    const renewed = await renewSession();

    if (renewed) return api<T>(path, { ...options, retryOnExpired: false });
  }

  if (!response.ok) throw await toError(response);

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

/** La dirección completa de una ruta del API, para quien no pase por `api()`. */
export function apiUrl(path: string): string {
  return `${API_URL}/api${path}`;
}

/**
 * Un `fetch` con la sesión puesta, para las respuestas que se leen en streaming
 * y no como JSON (el asistente). Renueva el token ante un 401 igual que `api()`,
 * y un error del servidor sale como `ApiError` con su mensaje.
 */
export const authorizedFetch: typeof fetch = async (input, init) => {
  const attempt = () => {
    const headers = new Headers(init?.headers);

    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    return fetch(input, { ...init, headers, credentials: 'include' });
  };

  let response = await attempt();

  if (response.status === 401 && (await renewSession())) response = await attempt();

  if (!response.ok) throw await toError(response);

  return response;
};

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
 * token ya canjeado, o sea un reuso: si llega pasados unos segundos, revoca la
 * familia entera y el usuario queda afuera.
 */
let renewal: Promise<SessionResponse | null> | null = null;

/**
 * La espera antes de reintentar un refresco rechazado. Tiene que quedar bien
 * dentro del margen que la API le da a las pestañas simultáneas
 * (`CONCURRENT_REFRESH_GRACE_MS`, 5 s): pasado ese margen, el reintento ya no
 * llega a tiempo y la otra pestaña cuenta como un robo.
 */
const RETRY_AFTER_MS = 400;

/** Se avisa cuando la sesión se termina de verdad, para no dejar la interfaz
 *  mostrando a un usuario que ya no existe. */
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

/**
 * Canjea la cookie de refresco por una sesión nueva, compartiendo el intento en
 * vuelo con quien lo pida a la vez.
 *
 * Tiene que pasar **todo el mundo** por acá, incluida la restauración al abrir
 * la aplicación. Dos canjes simultáneos mandan la misma cookie: el servidor rota
 * el token con el primero y rechaza el segundo como un token ya usado (pasados
 * unos segundos, además revoca la familia entera: es su defensa contra un token
 * robado). El usuario aparece deslogueado sin haber hecho nada.
 *
 * Pasa de verdad en desarrollo: con `reactStrictMode` React monta los efectos
 * dos veces, así que la restauración se dispara dos veces en el mismo instante.
 */
export function renewSession(): Promise<SessionResponse | null> {
  renewal ??= (async () => {
    try {
      let response = await send('/auth/refresh', { method: 'POST' });

      /*
       * Otra pestaña del mismo navegador pudo canjear la misma cookie un
       * instante antes (pasa al reabrir el navegador con varias pestañas). El
       * servidor rechaza la segunda sin cerrar la sesión, y para cuando se
       * reintenta la cookie nueva ya llegó. Si la sesión venció, falla igual.
       */
      if (response.status === 401) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
        response = await send('/auth/refresh', { method: 'POST' });
      }

      if (!response.ok) {
        accessToken = null;
        onSessionLost?.();

        return null;
      }

      const session = (await response.json()) as SessionResponse;
      accessToken = session.accessToken;

      return session;
    } catch {
      return null;
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
