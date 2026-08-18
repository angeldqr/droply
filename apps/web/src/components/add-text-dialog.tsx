'use client';

import { TEXT_ITEM_MAX_LENGTH } from '@droply/contracts';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { useAddTextItem } from '@/lib/libraries';

export function AddTextDialog({
  libraryId,
  open,
  onOpenChange,
  toProps,
}: {
  libraryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toProps: { 'data-blendy-to': string };
}) {
  const addText = useAddTextItem(libraryId);
  const [text, setText] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await addText.mutateAsync({ text });
      setText('');
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo guardar el texto.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MorphDialogContent toProps={toProps}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Agregar un texto</DialogTitle>
            <DialogDescription>
              Se envía tal cual, así que escríbelo como quieres que llegue.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-6">
            <Field>
              <FieldLabel htmlFor="text">Mensaje</FieldLabel>
              <Textarea
                id="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={5}
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={addText.isPending || text.trim().length === 0}>
              {addText.isPending ? <Spinner /> : null}
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </MorphDialogContent>
    </Dialog>
  );
}
