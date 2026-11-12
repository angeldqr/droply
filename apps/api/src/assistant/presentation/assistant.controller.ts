import { Controller, Inject, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { assistantChatSchema, type AssistantChatInput } from '@reconectate/contracts';
import type { FastifyReply } from 'fastify';
import { CurrentUserId } from '../../platform/http/current-user.decorator';
import { ZodBody } from '../../platform/http/zod-body.decorator';
import type { UserId } from '../../shared/identifiers';
import { orThrow } from '../../shared/result';
import { AskAssistant } from '../application/ask-assistant';

@Controller('assistant')
export class AssistantController {
  constructor(@Inject(AskAssistant) private readonly ask: AskAssistant) {}

  /**
   * Responde en streaming, en el formato que entiende `useChat` de la web.
   *
   * La respuesta se manda con `reply.send` y no escribiendo en `reply.raw`: lo
   * crudo se saltaría los encabezados de CORS y de helmet que pone Fastify.
   */
  @Post('chat')
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  async chat(
    @CurrentUserId() userId: UserId,
    @ZodBody(assistantChatSchema) body: AssistantChatInput,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    // Si quien preguntó cierra la pestaña o empieza otra conversación, se corta
    // el modelo: seguir generando gastaría cuota que no va a leer nadie.
    const abort = new AbortController();
    reply.raw.on('close', () => abort.abort());

    const response = orThrow(await this.ask.execute(userId, body.messages, abort.signal));

    response.headers.forEach((value, name) => void reply.header(name, value));

    await reply.status(response.status).send(response.body);
  }
}
