'use client';

import type { LibrarySummary } from '@droply/contracts';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useLibraryRecipients, useSetLibraryRecipients } from '@/lib/libraries';
import { useMorphDialog } from '@/lib/morph-dialog';
import { useRecipients } from '@/lib/recipients';

/**
 * A quién se le puede enviar lo de esta biblioteca.
 *
 * La lista vive en la biblioteca y no en el horario porque es una decisión
 * sobre el contenido: las fotos de la abuela no van al grupo del trabajo, y eso
 * no cambia según el día ni la hora a la que se manden. Un horario solo puede
 * elegir entre los que estén marcados acá.
 *
 * Solo aparecen los que ya apretaron Empezar: apuntar una biblioteca a alguien
 * que nunca habló con el bot sería guardar una intención que no puede cumplirse.
 */
export function LibraryRecipientsDialog({ library }: { library: LibrarySummary }) {
  const dialog = useMorphDialog(`destinatarios-${library.id}`);
  const recipients = useRecipients();
  const chosen = useLibraryRecipients(library.id);
  const save = useSetLibraryRecipients(library.id);

  const [selected, setSelected] = useState<string[]>([]);

  // La respuesta del servidor manda mientras el diálogo esté cerrado; una vez
  // abierto, lo que manda es lo que el usuario va marcando.
  useEffect(() => {
    if (!dialog.open && chosen.data) setSelected(chosen.data);
  }, [dialog.open, chosen.data]);

  const linked = recipients.data?.filter((recipient) => recipient.status === 'VERIFIED') ?? [];

  function toggle(recipientId: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, recipientId] : current.filter((id) => id !== recipientId),
    );
  }

  async function onSave() {
    try {
      await save.mutateAsync({ recipientIds: selected });
      dialog.close();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo guardar.');
    }
  }

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span className="flex items-center gap-2">
            <Send className="size-4" />
            Destinatarios
            {selected.length > 0 ? (
              <span className="bg-secondary rounded-full px-1.5 text-xs tabular-nums">
                {selected.length}
              </span>
            ) : null}
          </span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps}>
        <div>
          <DialogHeader>
            <DialogTitle>Destinatarios de {library.name}</DialogTitle>
            <DialogDescription>
              A quién se le puede enviar lo de esta biblioteca. Después, cada horario elige a uno de
              estos.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 overflow-y-auto py-6">
            {recipients.isPending || chosen.isPending ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-8 w-full" />
                ))}
              </div>
            ) : linked.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nadie vinculado todavía</EmptyTitle>
                  <EmptyDescription>
                    Solo se puede enviar a quien ya abrió su enlace.{' '}
                    <Link href="/destinatarios" className="underline underline-offset-4">
                      Ir a destinatarios
                    </Link>
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="flex flex-col gap-1">
                {linked.map((recipient) => (
                  <li key={recipient.id}>
                    <label className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-2 py-2">
                      <Checkbox
                        checked={selected.includes(recipient.id)}
                        onCheckedChange={(checked) => toggle(recipient.id, checked === true)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{recipient.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={dialog.close}>
              Cancelar
            </Button>
            <Button onClick={() => void onSave()} disabled={save.isPending}>
              {save.isPending ? <Spinner /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </div>
      </MorphDialogContent>
    </Dialog>
  );
}
