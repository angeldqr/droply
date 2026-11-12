import { z } from 'zod';

/** Cuántos turnos de la conversación viajan en cada pregunta. Los más viejos se quedan en la web. */
export const ASSISTANT_MAX_TURNS = 20;

/** Lo más largo que puede escribir el usuario en una pregunta. */
export const ASSISTANT_QUESTION_MAX_LENGTH = 2_000;

/** Lo más largo que puede volver una respuesta del asistente en el historial. */
export const ASSISTANT_ANSWER_MAX_LENGTH = 8_000;

const turnSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('user'),
    text: z.string().trim().min(1).max(ASSISTANT_QUESTION_MAX_LENGTH),
  }),
  z.object({
    role: z.literal('assistant'),
    text: z.string().trim().min(1).max(ASSISTANT_ANSWER_MAX_LENGTH),
  }),
]);

/**
 * Una pregunta al asistente, con la conversación que lleva.
 *
 * Solo viaja texto: la web reduce cada mensaje a lo que se leyó en pantalla.
 * Así nadie puede colar una respuesta de herramienta inventada, y el servidor
 * no guarda nada entre preguntas.
 */
export const assistantChatSchema = z.object({
  messages: z
    .array(turnSchema)
    .min(1)
    .max(ASSISTANT_MAX_TURNS)
    .refine((turns) => turns.at(-1)?.role === 'user', {
      message: 'La conversación tiene que terminar en una pregunta.',
    }),
});

export type AssistantChatInput = z.infer<typeof assistantChatSchema>;
