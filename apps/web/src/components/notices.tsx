'use client';

import { BellRing, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useMarkNoticeRead, useNotices } from '@/lib/schedules';

const WHEN = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Lo que la aplicación tiene que contarle al dueño de la cuenta.
 *
 * Va acá arriba y no en una campana escondida porque los avisos que existen son
 * de una sola clase: algo dejó de enviarse. Quien entra a esta pantalla viene
 * justo a preguntarse por qué no llegó nada, y la respuesta tiene que estar a
 * la vista, no detrás de un icono.
 *
 * No se puede avisar por Telegram: el único chat que la aplicación conoce de
 * una cuenta es el de sus destinatarios, y esos son otras personas.
 */
export function Notices() {
  const notices = useNotices();
  const markRead = useMarkNoticeRead();

  if (!notices.data || notices.data.length === 0) return null;

  return (
    <div className="mb-6 flex flex-col gap-2">
      {notices.data.map((notice) => (
        <Alert key={notice.id} variant="destructive">
          <BellRing />
          <AlertTitle>{notice.text}</AlertTitle>
          <AlertDescription>{WHEN.format(new Date(notice.createdAt))}</AlertDescription>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Descartar este aviso"
            className="absolute right-2 top-2"
            onClick={() => markRead.mutate(notice.id)}
          >
            <X />
          </Button>
        </Alert>
      ))}
    </div>
  );
}
