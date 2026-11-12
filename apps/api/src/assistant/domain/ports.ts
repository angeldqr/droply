import type { UserId } from '../../shared/identifiers';

/** Un turno de la conversación, ya reducido a su texto. */
export interface ChatTurn {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

/**
 * Una lectura que el modelo puede pedir.
 *
 * Ya viene atada a la cuenta de la sesión: el modelo elige cuál usar y, si
 * acaso, de qué plan o biblioteca, pero nunca de quién.
 */
export interface AssistantTool {
  readonly name: string;
  readonly description: string;
  /** Si lee un elemento suelto, cómo se le explica al modelo qué id pasar. Sin esto, no lleva parámetros. */
  readonly idDescription?: string;
  run(id?: string): Promise<unknown>;
}

export interface AssistantRequest {
  /** Lo que cambia en cada pregunta: quién pregunta y qué hora es para él. */
  readonly context: string;
  readonly turns: readonly ChatTurn[];
  readonly tools: readonly AssistantTool[];
  /** Se dispara si quien preguntó se fue: no tiene sentido seguir gastando cuota. */
  readonly signal?: AbortSignal | undefined;
}

/**
 * El modelo de lenguaje. Las reglas de qué puede responder y la guía de la
 * aplicación son suyas, porque son las instrucciones que le llegan a él.
 *
 * Devuelve la respuesta HTTP ya en streaming: el formato del stream es el que
 * entiende el chat de la web y no tiene sentido traducirlo dos veces.
 */
export interface AssistantModel {
  answer(request: AssistantRequest): Response;
}

export interface AccountProfile {
  readonly name: string;
  readonly timezone: string;
}

/** Lo que `assistant` necesita saber de la cuenta para presentarse. */
export interface AccountReader {
  profileOf(ownerId: UserId): Promise<AccountProfile>;
}

export const ASSISTANT_MODEL = Symbol('AssistantModel');
export const ASSISTANT_ACCOUNT_READER = Symbol('AssistantAccountReader');
