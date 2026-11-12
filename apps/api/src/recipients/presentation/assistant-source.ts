import type { AssistantSource } from '../../shared/assistant-source';
import type { ListRecipients } from '../application/recipient-use-cases';

/** Los destinatarios, para el asistente. El código de vinculación no sale nunca. */
export function recipientsSource(listRecipients: ListRecipients): AssistantSource {
  return {
    async list(ownerId) {
      return (await listRecipients.execute(ownerId)).map((recipient) => ({
        nombre: recipient.label,
        canal: recipient.channel,
        vinculado: recipient.verifiedAt !== null,
      }));
    },
  };
}
