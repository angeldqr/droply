'use client';

import {
  COLUMN_LABELS,
  MEDIA_LIMITS,
  megabytes,
  requestUploadSchema,
  type UploadableKind,
} from '@reconectate/contracts';
import { useState } from 'react';
import { toast } from 'sonner';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileUpload } from '@/components/ui/file-upload';
import { Progress } from '@/components/ui/progress';
import { ApiError } from '@/lib/api';
import { compressImage } from '@/lib/compress-image';
import { useUploadMedia } from '@/lib/libraries';

/**
 * Por qué no entró.
 *
 * El mensaje del esquema dice el número y ya. Para el tamaño hace falta decir
 * de quién es el techo: una imagen llega acá **después** de comprimirse, así
 * que "hasta 10 MB" sonaría a que no se intentó nada; y en audio y vídeo el
 * límite es de Telegram, no nuestro, que es lo que explica por qué no se puede
 * subir y ya.
 */
function rejection(
  kind: UploadableKind,
  maxBytes: number,
  issue: { path: PropertyKey[]; message: string } | undefined,
): string {
  if (issue?.path[0] !== 'sizeBytes') {
    return issue?.message ?? 'Ese archivo no sirve para esta columna.';
  }

  return kind === 'IMAGE'
    ? `Ni comprimida baja de ${megabytes(maxBytes)}, que es lo que acepta Telegram en una foto.`
    : `Telegram no acepta más de ${megabytes(maxBytes)} en un archivo, y este pasa de ahí.`;
}

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
  const [preparing, setPreparing] = useState(false);
  const [round, setRound] = useState(0);

  const limits = MEDIA_LIMITS[kind];

  async function onPick(files: File[]) {
    const file = files[0];
    if (!file) return;

    /*
     * Las imágenes se comprimen antes de medirlas: el techo se aplica a lo que
     * de verdad se va a subir, no a lo que el usuario eligió. Una foto de
     * cuarenta megas cabe de sobra después de pasar por acá.
     */
    let ready = file;

    if (kind === 'IMAGE') {
      setPreparing(true);

      try {
        ready = await compressImage(file, limits.maxBytes);
      } finally {
        setPreparing(false);
      }
    }

    /*
     * El mismo esquema que valida el servidor, corrido acá para avisar en el
     * acto. La zona de arrastre no filtra por tipo —acepta lo que le suelten—
     * así que esta comprobación es lo único que separa un vídeo de ochenta
     * megas de un viaje de subida que iba a fallar igual.
     */
    const check = requestUploadSchema.safeParse({
      kind,
      fileName: ready.name,
      mimeType: ready.type,
      sizeBytes: ready.size,
    });

    if (!check.success) {
      toast.error(rejection(kind, limits.maxBytes, check.error.issues[0]));
      setRound((current) => current + 1);

      return;
    }

    setProgress(0);

    try {
      await upload.mutateAsync({ kind, file: ready, onProgress: setProgress });
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
              {kind === 'IMAGE'
                ? 'Suéltala acá o búscala en tu equipo. Si pesa de más, se comprime sola.'
                : `Suéltalo acá o búscalo en tu equipo. Hasta ${megabytes(limits.maxBytes)}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="border-border mt-4 rounded-lg border border-dashed">
            <FileUpload key={round} onChange={(files) => void onPick(files)} />
          </div>

          {preparing ? (
            <p className="text-muted-foreground mt-4 text-sm" role="status">
              Comprimiendo la imagen…
            </p>
          ) : null}

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
