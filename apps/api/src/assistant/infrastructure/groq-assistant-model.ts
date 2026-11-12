import { createGroq, type GroqProvider } from '@ai-sdk/groq';
import { Logger } from '@nestjs/common';
import { APICallError, RetryError, stepCountIs, streamText, tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { AssistantModel, AssistantRequest, AssistantTool } from '../domain/ports';
import { GUIA } from './guia';

/**
 * El modelo, en el plan gratuito de Groq.
 *
 * Para cambiar de proveedor (Claude, Gemini, uno local) basta con otro
 * adaptador del AI SDK en lugar de `createGroq`: las herramientas, el streaming
 * y el formato que entiende la web no cambian.
 */
const MODEL = 'openai/gpt-oss-120b';

/** Cuántas idas y vueltas con herramientas antes de responder. */
const MAX_STEPS = 5;

const LIMIT_MESSAGE = 'El asistente llegó a su límite por hoy. Vuelve mañana.';
const FAILURE_MESSAGE = 'El asistente no pudo responder. Intenta de nuevo en un momento.';

export class GroqAssistantModel implements AssistantModel {
  private readonly logger = new Logger(GroqAssistantModel.name);
  private readonly groq: GroqProvider;

  constructor(apiKey: string) {
    this.groq = createGroq({ apiKey });
  }

  answer({ context, turns, tools, signal }: AssistantRequest): Response {
    const result = streamText({
      model: this.groq(MODEL),
      instructions: `${GUIA}\n\n${context}`,
      messages: turns.map((turn) => ({ role: turn.role, content: turn.text })),
      tools: toolSet(tools),
      stopWhen: stepCountIs(MAX_STEPS),
      ...(signal ? { abortSignal: signal } : {}),
      maxOutputTokens: 1_500,
      // Pensar poco alcanza para leer y resumir, y gasta menos del tope diario.
      providerOptions: { groq: { reasoningEffort: 'low' } },
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: false,
      onError: (error) => {
        if (isQuotaError(error)) return LIMIT_MESSAGE;

        this.logger.error('El asistente falló.', error);

        return FAILURE_MESSAGE;
      },
    });
  }
}

function toolSet(tools: readonly AssistantTool[]): ToolSet {
  return Object.fromEntries(
    tools.map((assistantTool) => [
      assistantTool.name,
      assistantTool.idDescription
        ? tool({
            description: assistantTool.description,
            inputSchema: z.object({ id: z.string().describe(assistantTool.idDescription) }),
            execute: ({ id }) => assistantTool.run(id),
          })
        : tool({
            description: assistantTool.description,
            inputSchema: z.object({}),
            execute: () => assistantTool.run(),
          }),
    ]),
  );
}

/**
 * Groq dice 429 cuando se acaba la cuota. Tras los reintentos del SDK el error
 * llega envuelto en un `RetryError`, así que se mira también el último intento.
 */
function isQuotaError(error: unknown): boolean {
  const cause = RetryError.isInstance(error) ? error.lastError : error;

  return APICallError.isInstance(cause) && cause.statusCode === 429;
}
