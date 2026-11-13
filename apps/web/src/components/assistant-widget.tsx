'use client';

import { useChat } from '@ai-sdk/react';
import {
  ASSISTANT_ANSWER_MAX_LENGTH,
  ASSISTANT_MAX_TURNS,
  ASSISTANT_QUESTION_MAX_LENGTH,
} from '@reconectate/contracts';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { MessageCircle, MessageCirclePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SignatureCard } from '@/components/signature-card';
import { LoaderFive } from '@/components/ui/loader';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import { ApiError, apiUrl, authorizedFetch } from '@/lib/api';
import { useMorphDialog } from '@/lib/morph-dialog';
import { cn } from '@/lib/utils';

/** Sirven de ejemplo dos veces: como botones al abrir y rotando en la caja de escribir. */
const SUGGESTIONS = [
  '¿Cómo voy en mi plan?',
  '¿Qué días no cumplí esta semana?',
  '¿Cómo creo un horario?',
];

/**
 * El 429 del tope por minuto lo pone el limitador general del API y llega en
 * inglés; el del tope diario ya trae su propio mensaje.
 */
function errorText(error: Error): string {
  if (error instanceof ApiError && error.status === 429 && error.code !== 'assistant.daily_limit') {
    return 'Vas muy rápido. Espera un minuto y vuelve a preguntar.';
  }

  return error.message;
}

/** Quita la negrita y los títulos de markdown que el modelo a veces se cuela. */
function plain(text: string): string {
  return text.replace(/\*\*|^#+\s*/gm, '');
}

function textOf(message: UIMessage): string {
  return message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
}

/**
 * Al servidor solo viaja el texto de cada turno, que es lo que acepta: nada de
 * herramientas ni razonamientos. Y solo los últimos, que el resto ya se leyó.
 */
const transport = new DefaultChatTransport({
  api: apiUrl('/assistant/chat'),
  fetch: authorizedFetch,
  prepareSendMessagesRequest: ({ messages }) => ({
    body: {
      messages: messages
        .flatMap((message) => {
          const text = textOf(message).trim();

          if (!text || (message.role !== 'user' && message.role !== 'assistant')) return [];

          const max =
            message.role === 'user' ? ASSISTANT_QUESTION_MAX_LENGTH : ASSISTANT_ANSWER_MAX_LENGTH;

          return [{ role: message.role, text: text.slice(0, max) }];
        })
        .slice(-ASSISTANT_MAX_TURNS),
    },
  }),
});

/** Los botones redondos que flotan sobre el degradado. */
const GLASS =
  'grid size-10 place-items-center rounded-full bg-sobre-menta/10 text-sobre-menta backdrop-blur-xs transition-colors hover:bg-sobre-menta/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sobre-menta disabled:opacity-40';

/**
 * El asistente: un botón redondo abajo a la derecha que se convierte en el chat.
 *
 * El chat crece desde el botón y vuelve a él al cerrar, con la misma transición
 * de los diálogos. No tiene encabezado ni burbujas: es una tarjeta de degradado
 * con el texto encima.
 *
 * Vive en `Providers` y no en cada pantalla, así la conversación sigue ahí al
 * navegar. No se guarda en ningún lado: se va al cerrar la pestaña o la sesión.
 */
export function AssistantWidget() {
  const morph = useMorphDialog('asistente');
  const [draft, setDraft] = useState('');
  const { messages, sendMessage, status, error, setMessages, stop, clearError } = useChat({
    transport,
  });

  const busy = status === 'submitted' || status === 'streaming';
  const last = messages.at(-1);
  // Mientras no llega la primera letra, la espera se nota: se muestra "Pensando…".
  const thinking = busy && (last?.role !== 'assistant' || !textOf(last).trim());

  const { open, close } = morph;
  const panel = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // El foco entra a la caja de escribir al abrir y vuelve al botón al cerrar:
  // quien usa el teclado no queda perdido detrás del chat.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      panel.current?.querySelector('input')?.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      button.current?.focus({ preventScroll: true });
    }
  }, [open]);

  // No es un diálogo modal: la página sigue usable detrás. Escape lo cierra igual.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  function ask(question: string) {
    const text = question.trim();

    if (!text || busy) return;

    clearError();
    void sendMessage({ text });
    setDraft('');
  }

  function restart() {
    stop();
    clearError();
    setMessages([]);
  }

  return (
    <>
      {open && (
        <section
          ref={panel}
          {...morph.toProps}
          aria-label="Asistente"
          // La menta va en la caja y no solo adentro: mientras crece desde el
          // botón, lo de adentro todavía no llegó y se vería un hueco.
          className="bg-menta shadow-sobre-menta/15 fixed inset-2 z-50 overflow-hidden rounded-[2.5rem] shadow-2xl sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(42rem,calc(100dvh-2rem))] sm:w-96"
        >
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <div className="size-full">
            <SignatureCard
              containerClassName="size-full rounded-none"
              className="flex size-full flex-col p-0 md:p-0"
            >
              <div className="absolute left-4 top-4 z-10 flex gap-2">
                <button
                  type="button"
                  className={GLASS}
                  onClick={close}
                  aria-label="Cerrar el asistente"
                >
                  <X className="size-5" />
                </button>
                <button
                  type="button"
                  className={GLASS}
                  onClick={restart}
                  disabled={messages.length === 0}
                  aria-label="Conversación nueva"
                  title="Conversación nueva"
                >
                  <MessageCirclePlus className="size-5" />
                </button>
              </div>

              <MessageScrollerProvider autoScroll>
                <MessageScroller className="min-h-0 flex-1">
                  <MessageScrollerViewport>
                    <MessageScrollerContent className="gap-6 px-6 pb-4 pt-20">
                      {messages.length === 0 && (
                        <div className="flex flex-col gap-5">
                          <p className="text-2xl font-medium leading-tight tracking-tight">
                            Pregúntame cómo vas, o cómo se hace algo en Reconéctate.
                          </p>
                          <div className="flex flex-col items-start gap-2">
                            {SUGGESTIONS.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                className="backdrop-blur-xs bg-sobre-menta/10 hover:bg-sobre-menta/20 focus-visible:outline-sobre-menta rounded-full px-4 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                                onClick={() => ask(suggestion)}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {messages.map((message) => {
                        const text = textOf(message);

                        if (!text.trim()) return null;

                        const mine = message.role === 'user';

                        return (
                          <MessageScrollerItem
                            key={message.id}
                            messageId={message.id}
                            scrollAnchor={mine}
                          >
                            {/*
                              Sin burbujas: la pregunta va a la derecha y más
                              apagada; la respuesta, grande y a la izquierda.
                            */}
                            <p
                              className={cn(
                                'animate-asentar whitespace-pre-wrap tracking-tight',
                                mine
                                  ? 'text-sobre-menta/60 ml-auto max-w-[85%] text-right text-base'
                                  : 'max-w-[95%] text-xl font-medium leading-snug',
                              )}
                            >
                              {plain(text)}
                            </p>
                          </MessageScrollerItem>
                        );
                      })}

                      {thinking && (
                        <div role="status" className="text-base">
                          <LoaderFive text="Pensando…" />
                        </div>
                      )}

                      {error && (
                        <p
                          role="alert"
                          className="bg-primary text-primary-foreground rounded-3xl px-4 py-3 text-sm"
                        >
                          {errorText(error)}
                        </p>
                      )}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton />
                </MessageScroller>
              </MessageScrollerProvider>

              <div className="p-3">
                <PlaceholdersAndVanishInput
                  label="Tu pregunta"
                  placeholders={SUGGESTIONS}
                  maxLength={ASSISTANT_QUESTION_MAX_LENGTH}
                  disabled={busy}
                  onChange={(event) => setDraft(event.target.value)}
                  onSubmit={() => ask(draft)}
                />
              </div>
            </SignatureCard>
          </div>
        </section>
      )}

      {/*
        En el teléfono sube para no quedar encima del dock. `aria-expanded`
        sigue acá aunque el botón se esconda al abrir: es quien controla el chat.
      */}
      <button
        ref={button}
        type="button"
        {...morph.fromProps}
        className="bg-menta ease-(--ease-rebote) text-sobre-menta shadow-sobre-menta/15 focus-visible:outline-sobre-menta fixed bottom-24 right-4 z-40 grid size-14 place-items-center rounded-full shadow-lg transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 md:bottom-4"
        onClick={morph.openDialog}
        aria-label="Abrir el asistente"
        aria-expanded={open}
      >
        {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
        <span className="grid place-items-center">
          <MessageCircle className="size-6" />
        </span>
      </button>
    </>
  );
}
