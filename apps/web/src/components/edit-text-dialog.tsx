'use client';

import { TEXT_ITEM_MAX_LENGTH } from '@reconectate/contracts';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useEditTextItem } from '@/lib/libraries';

/**
 * Corrige un texto ya guardado: una tilde o una letra no obligan a borrarlo y
 * crearlo otra vez. Lo que se envíe desde ahora ya sale corregido.
 *
 * Se monta solo mientras está abierto, así que cada vez arranca con el texto
 * que hay guardado y no con lo que quedó a medias la vez anterior.
 */
export function EditTextDialog({
  libraryId,
  itemId,
  initialText,
  onClose,
}: {
  libraryId: string;
  itemId: string;
  initialText: string;
  onClose: () => void;
}) {
  const edit = useEditTextItem(libraryId);
  const [text, setText] = useState(initialText);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await edit.mutateAsync({ itemId, text });
      onClose();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo guardar el texto.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Editar el texto</DialogTitle>
            <DialogDescription>Lo que se envíe desde ahora sale con este cambio.</DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor="edit-text">Mensaje</FieldLabel>
              <Textarea
                id="edit-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={6}
                maxLength={TEXT_ITEM_MAX_LENGTH}
                autoFocus
                required
              />
              <FieldDescription>
                {text.length} de {TEXT_ITEM_MAX_LENGTH} caracteres
              </FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={edit.isPending || text.trim().length === 0 || text === initialText}
            >
              {edit.isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
