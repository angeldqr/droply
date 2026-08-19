'use client';

import {
  COLUMN_LABELS,
  MEDIA_LIMITS,
  megabytes,
  requestUploadSchema,
  type UploadableKind,
} from '@droply/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Progress } from '@/components/ui/progress';
import { ApiError } from '@/lib/api';
import { useUploadMedia } from '@/lib/libraries';

/**
 * Subir un archivo, con la zona de arrastre de Aceternity dentro del diálogo
 * que nace del botón de más.
 *
 * Antes era un `<input type="file">` escondido: se abría el diálogo del sistema
 * y no había forma de arrastrar nada. La zona de arrastre resuelve eso y de paso
 * enseña los techos de la columna antes de que alguien elija un archivo de
 * ochenta megas y se lo rechacen después.
 *
 * El componente guarda por dentro la lista de lo que se soltó y no expone forma
 * de vaciarla, así que se remonta con una llave nueva después de cada subida:
 * si no, el archivo anterior seguiría a la vista sobre el siguiente.
 */
export function UploadDialog({
  libraryId,
  kind,
  open,
  onOpenChange,
  toProps,
}: {
  libraryId: string;
  kind: UploadableKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toProps: { 'data-blendy-to': string };
}) {
  const upload = useUploadMedia(libraryId);
  const [progress, setProgress] = useState<number | null>(null);
  const [round, setRound] = useState(0);

  const limits = MEDIA_LIMITS[kind];

  async function onPick(files: File[]) {
    const file = files[0];
    if (!file) return;

    /*
     * El mismo esquema que valida el servidor, corrido acá para avisar en el
     * acto. La zona de arrastre no filtra por tipo —acepta lo que le suelten—
     * así que esta comprobación es lo único que separa un vídeo de ochenta
     * megas de un viaje de subida que iba a fallar igual.
     */
    const check = requestUploadSchema.safeParse({
      kind,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });

    if (!check.success) {
      toast.error(check.error.issues[0]?.message ?? 'Ese archivo no sirve para esta columna.');
      setRound((current) => current + 1);

      return;
    }

    setProgress(0);

    try {
      await upload.mutateAsync({ kind, file, onProgress: setProgress });
      onOpenChange(false);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'No se pudo subir el archivo.');
    } finally {
      setProgress(null);
      setRound((current) => current + 1);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MorphDialogContent toProps={toProps} className="sm:max-w-lg">
        <div>
          <DialogHeader>
            <DialogTitle>Agregar a {COLUMN_LABELS[kind]}</DialogTitle>
            <DialogDescription>
              Suéltalo acá o búscalo en tu equipo. Hasta {megabytes(limits.maxBytes)}.
            </DialogDescription>
          </DialogHeader>

          <div className="border-border mt-4 rounded-lg border border-dashed">
            <FileUpload key={round} onChange={(files) => void onPick(files)} />
          </div>

          {progress === null ? null : (
            <Progress
              value={Math.round(progress * 100)}
              aria-label={`Subiendo a ${COLUMN_LABELS[kind]}`}
              className="mt-4"
            />
          )}
        </div>
      </MorphDialogContent>
    </Dialog>
  );
}
