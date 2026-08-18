'use client';

import { TEXT_ITEM_MAX_LENGTH } from '@droply/contracts';
import { FileText } from 'lucide-react';
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
  const input = useRef<HTMLInputElement>(null);

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

  /*
   * Un archivo de texto se lee acá y se queda en el cuadro, donde todavía se
   * puede corregir antes de guardarlo. No se sube al almacenamiento: un texto
   * vive en su propia columna de la base, y darle la vuelta del archivo firmado
   * sería mover kilobytes por el camino de los cincuenta megas.
   */
  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Se limpia enseguida para que elegir el mismo archivo otra vez vuelva a
    // disparar el evento.
    event.target.value = '';

    if (!file) return;

    const content = await file.text();

    if (content.trim().length === 0) {
      toast.error('Ese archivo está vacío.');
      return;
    }

    if (content.length > TEXT_ITEM_MAX_LENGTH) {
      toast.warning(`El archivo es largo: se recortó a ${TEXT_ITEM_MAX_LENGTH} caracteres.`);
    }

    setText(content.slice(0, TEXT_ITEM_MAX_LENGTH));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MorphDialogContent toProps={toProps}>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Agregar un texto</DialogTitle>
            <DialogDescription>
              Se envía tal cual, así que escríbelo como quieres que llegue. También puedes traerlo
              de un archivo y retocarlo acá.
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

            <input
              ref={input}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={onPickFile}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => input.current?.click()}
            >
              <FileText /> Traer de un archivo
            </Button>
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
