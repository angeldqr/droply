'use client';

import { useChat } from '@ai-sdk/react';
import {
  ASSISTANT_ANSWER_MAX_LENGTH,
  ASSISTANT_MAX_TURNS,
  ASSISTANT_QUESTION_MAX_LENGTH,
} from '@reconectate/contracts';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { ArrowUp, MessageCircle, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { Message, MessageContent } from '@/components/ui/message';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, apiUrl, authorizedFetch } from '@/lib/api';

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

/**
 * El asistente: un botón redondo abajo a la derecha que abre el chat.
 *
 * Vive en `Providers` y no en cada pantalla, así la conversación sigue ahí al
 * navegar. No se guarda en ningún lado: se va al cerrar la pestaña o la sesión.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const { messages, sendMessage, status, error, setMessages, stop, clearError } = useChat({
    transport,
  });

  const busy = status === 'submitted' || status === 'streaming';
  const last = messages.at(-1);
  // Mientras no llega la primera letra, la espera se nota: se muestra "Pensando…".
  const thinking = busy && (last?.role !== 'assistant' || !textOf(last).trim());

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
      <AnimatePresence>
        {open && (
          <motion.section
            key="assistant"
            aria-label="Asistente"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-background fixed inset-0 z-50 flex origin-bottom-right flex-col overflow-hidden sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[min(560px,calc(100dvh-7rem))] sm:w-[380px] sm:rounded-2xl sm:border sm:shadow-xl"
          >
            <header className="flex items-center gap-2 border-b px-4 py-3">
              <MessageCircle className="text-muted-foreground size-4" aria-hidden />
              <h2 className="flex-1 text-sm font-semibold">Asistente</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={restart}
                disabled={messages.length === 0}
                aria-label="Nueva conversación"
                title="Nueva conversación"
              >
                <RotateCcw />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Cerrar el asistente"
              >
                <X />
              </Button>
            </header>

            <MessageScrollerProvider autoScroll>
              <MessageScroller className="flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="gap-4 p-4">
                    {messages.length === 0 && (
                      <div className="text-muted-foreground flex flex-col gap-3 text-sm">
                        <p>
                          Pregúntame cómo funciona Reconéctate o cómo vas con tus planes, tu
                          bitácora, tus bibliotecas y tus envíos.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {SUGGESTIONS.map((suggestion) => (
                            <Button
                              key={suggestion}
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => ask(suggestion)}
                            >
                              {suggestion}
                            </Button>
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
                          <Message align={mine ? 'end' : 'start'}>
                            <MessageContent>
                              <Bubble
                                align={mine ? 'end' : 'start'}
                                variant={mine ? 'default' : 'muted'}
                              >
                                <BubbleContent className="whitespace-pre-wrap">
                                  {plain(text)}
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      );
                    })}

                    {thinking && (
                      <p
                        className="text-muted-foreground flex items-center gap-2 text-sm"
                        role="status"
                      >
                        <Spinner className="size-4" /> Pensando…
                      </p>
                    )}

                    {error && (
                      <Bubble variant="destructive" role="alert">
                        <BubbleContent>{errorText(error)}</BubbleContent>
                      </Bubble>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>

            <form
              className="border-t p-3"
              onSubmit={(event) => {
                event.preventDefault();
                ask(draft);
              }}
            >
              <InputGroup>
                <InputGroupTextarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter manda; Shift + Enter hace un salto de línea.
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      ask(draft);
                    }
                  }}
                  maxLength={ASSISTANT_QUESTION_MAX_LENGTH}
                  rows={1}
                  placeholder="Escribe tu pregunta…"
                  aria-label="Tu pregunta"
                  className="max-h-32"
                />
                <InputGroupAddon align="block-end" className="justify-end">
                  <InputGroupButton
                    type="submit"
                    variant="default"
                    size="icon-sm"
                    disabled={busy || !draft.trim()}
                    aria-label="Enviar"
                    className="rounded-full"
                  >
                    <ArrowUp />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <Button
        size="icon-lg"
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Cerrar el asistente' : 'Abrir el asistente'}
        aria-expanded={open}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
    </>
  );
}
