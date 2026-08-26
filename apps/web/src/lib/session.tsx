'use client';

import type { AuthenticatedUser, LoginInput, SessionResponse } from '@reconectate/contracts';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, renewSession, setAccessToken, setSessionLostHandler } from './api';

interface SessionState {
  readonly user: AuthenticatedUser | null;
  /** Mientras se resuelve si había sesión, no se decide nada todavía. */
  readonly loading: boolean;
  signIn: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /*
   * Al abrir la aplicación no hay token en memoria, pero puede quedar la cookie
   * de refresco de una visita anterior. Se canjea para seguir sin pedir la
   * contraseña otra vez.
   *
   * Va por `renewSession()` y no por una llamada suelta: ese canje comparte el
   * intento en vuelo. Con `reactStrictMode` este efecto se monta dos veces, y
   * dos canjes con la misma cookie hacen que el servidor lea el segundo como un
   * token reusado y revoque la sesión entera.
   */
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const session = await renewSession();

      if (cancelled) return;

      setUser(session?.user ?? null);
      setLoading(false);
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, []);

  // Si un refresco falla en medio de la navegación, la sesión se terminó y la
  // interfaz tiene que enterarse: si no, sigue mostrando al usuario mientras
  // todas las peticiones fallan.
  useEffect(() => {
    setSessionLostHandler(() => setUser(null));

    return () => setSessionLostHandler(null);
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    const session = await api<SessionResponse>('/auth/login', { method: 'POST', body: input });

    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  const signOut = useCallback(async () => {
    await api<void>('/auth/logout', { method: 'POST' });

    setAccessToken(null);
    setUser(null);
    router.push('/entrar');
  }, [router]);

  return (
    <SessionContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);

  if (!context) throw new Error('useSession necesita estar dentro de SessionProvider.');

  return context;
}
