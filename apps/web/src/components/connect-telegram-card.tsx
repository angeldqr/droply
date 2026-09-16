'use client';

import { JOURNAL_COMMAND } from '@reconectate/contracts';
import { Check, Copy, ImageIcon, Link2Off, Send } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useAccountChat, useLinkAccountChat, useUnlinkAccountChat } from '@/lib/journal';

/**
 * Cómo se usa la bitácora, y el paso para conectarla.
 *
 * Es la franja oscura de arriba de «Mi bitácora». A la izquierda, los tres
 * pasos y el estado de la conexión; a la derecha, una conversación de ejemplo
 * armada con **los hábitos de quien mira**, para que se entienda qué va a ver en
 * el chat antes de abrirlo.
 *
 * Conectar va acá y no en «Tu cuenta» porque sin ese paso la bitácora no sirve:
 * la aplicación conocía el chat de tus destinatarios, pero nunca el tuyo.
 */
export function ConnectTelegramCard({ habitNames }: { habitNames: readonly string[] }) {
  const chat = useAccountChat();

  return (
    <section className="bg-ciruela-900 text-papel-50 grid gap-8 overflow-hidden rounded-2xl p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-morado-400 text-xs font-bold uppercase tracking-[0.16em]">
            Desde Telegram
          </p>
          <h2 className="font-display text-2xl font-bold leading-tight md:text-3xl">
            Cuéntale al bot qué hiciste
          </h2>
          <p className="text-papel-50/70 max-w-prose text-sm">
            Nada de recordatorios: tú escribes cuando quieras y aquí queda guardado.
          </p>
        </div>

        <ol className="flex flex-col gap-3 text-sm">
          <Step n={1}>
            Escribe{' '}
            <code className="bg-papel-50/10 rounded px-1.5 py-0.5 font-mono">
              {JOURNAL_COMMAND}
            </code>{' '}
            en el chat.
          </Step>
          <Step n={2}>Elige el hábito del que quieres contar.</Step>
          <Step n={3}>Manda texto y fotos, y aprieta Listo.</Step>
        </ol>

        {chat.isPending ? (
          <Skeleton className="bg-papel-50/10 h-10 w-56" />
        ) : chat.data?.linked ? (
          <Linked />
        ) : (
          <Connect />
        )}
      </div>

      <ChatPreview habitNames={habitNames} />
    </section>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="border-papel-50/25 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function Linked() {
  const unlink = useUnlinkAccountChat();

  async function disconnect(): Promise<void> {
    try {
      await unlink.mutateAsync();
      toast.success('Telegram desconectado.');
    } catch {
      toast.error('No se pudo desconectar.');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="bg-logro-600/25 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold">
        <span className="bg-logro-600 size-2 rounded-full" aria-hidden />
        Tu Telegram está conectado
      </span>

      <Button
        variant="ghost"
        size="sm"
        className="text-papel-50/70 hover:bg-papel-50/10 hover:text-papel-50"
        onClick={() => void disconnect()}
        disabled={unlink.isPending}
      >
        {unlink.isPending ? <Spinner /> : <Link2Off />}
        Desconectar
      </Button>
    </div>
  );
}

function Connect() {
  const link = useLinkAccountChat();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function ask(): Promise<void> {
    try {
      const issued = await link.mutateAsync();

      // El código en claro solo existe en esta respuesta: en la base vive
      // hasheado y la consulta no puede volver a mostrarlo.
      setUrl(issued.linkUrl);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo generar el enlace.');
    }
  }

  async function copy(): Promise<void> {
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el enlace sigue a la vista y seleccionable.
      toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.');
    }
  }

  if (!url) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-papel-50/70 text-sm">
          Primero conecta tu Telegram, una sola vez, para que el bot sepa que eres tú.
        </p>
        <div>
          <Button
            onClick={() => void ask()}
            disabled={link.isPending}
            className="bg-papel text-ciruela-900 hover:bg-lavanda-200"
          >
            {link.isPending ? <Spinner /> : <Send />}
            Conectar mi Telegram
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-papel text-ciruela-900 hover:bg-lavanda-200">
          <a href={url} target="_blank" rel="noreferrer">
            <Send />
            Abrir en Telegram
          </a>
        </Button>
      </div>

      <InputGroup className="bg-papel text-ciruela-900">
        <InputGroupInput readOnly value={url} aria-label="Tu enlace para conectar Telegram" />
        <InputGroupAddon align="inline-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => void copy()}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </InputGroupAddon>
      </InputGroup>

      <p className="text-papel-50/60 text-xs">
        Si Telegram está en otro dispositivo, copia el enlace y ábrelo allí. Aprieta Empezar. Vence
        en un día.
      </p>
    </div>
  );
}

/**
 * Una conversación de muestra, con los nombres reales de los hábitos.
 *
 * Es ilustración, no interfaz: los pasos de la izquierda ya dicen lo mismo en
 * texto, así que para un lector de pantalla queda oculta.
 */
function ChatPreview({ habitNames }: { habitNames: readonly string[] }) {
  const names = habitNames.length > 0 ? habitNames.slice(0, 3) : ['Ejercicio', 'Lectura'];
  const first = names[0] ?? 'Ejercicio';

  return (
    <div
      aria-hidden
      className="bg-papel-50/[0.06] border-papel-50/10 flex flex-col gap-2 self-center rounded-2xl border p-4 text-sm"
    >
      <Bubble mine>{JOURNAL_COMMAND}</Bubble>

      <Bubble>
        <span>¿De cuál quieres contarme?</span>
        <span className="mt-2 flex flex-col gap-1">
          {names.map((name, index) => (
            <span
              key={`${name}-${index}`}
              className={
                index === 0
                  ? 'bg-morado-400 text-ciruela-900 rounded-lg px-3 py-1 text-center font-semibold'
                  : 'bg-papel-50/10 rounded-lg px-3 py-1 text-center'
              }
            >
              {index + 1} · {name}
            </span>
          ))}
        </span>
      </Bubble>

      <Bubble mine>Hoy lo hice mejor que ayer 💪</Bubble>

      <Bubble mine>
        <span className="bg-papel-50/15 grid h-16 w-28 place-items-center rounded-lg">
          <ImageIcon className="size-5 opacity-70" />
        </span>
      </Bubble>

      <Bubble>Anotado en {first}: lo que escribiste y una foto.</Bubble>
    </div>
  );
}

function Bubble({ mine = false, children }: { mine?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        mine
          ? 'bg-morado-700 max-w-[85%] self-end rounded-2xl rounded-br-md px-3 py-2'
          : 'bg-papel-50/10 flex max-w-[85%] flex-col self-start rounded-2xl rounded-bl-md px-3 py-2'
      }
    >
      {children}
    </div>
  );
}
