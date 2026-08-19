/**
 * El aviso de que a un horario le tocaba enviar algo.
 *
 * Vive en `shared` y no en un contexto porque es justamente la costura entre
 * dos: `scheduling` decide **cuándo**, `delivery` decide **qué** y lo manda. Un
 * contexto no puede importar el dominio de otro, así que el contrato que los
 * une tiene que estar donde los dos pueden verlo.
 *
 * `key` es `horario:instante`: la misma ocurrencia avisada dos veces —por un
 * reintento o por dos réplicas— trae la misma clave, y quien la recibe la usa
 * para no mandar dos veces lo mismo.
 */
export interface DueOccurrenceEvent {
  readonly scheduleId: string;
  readonly occurredAt: Date;
  readonly key: string;
}

export interface OccurrenceSink {
  emit(occurrence: DueOccurrenceEvent): Promise<void>;
}

export const OCCURRENCE_SINK = Symbol('OccurrenceSink');
