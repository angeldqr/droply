'use client';

import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogContent } from '@/components/ui/dialog';

/**
 * El contenido de un diálogo que entra y sale con Blendy.
 *
 * Blendy escala la caja entera y le aplica la escala inversa a **un solo hijo**
 * —el primero— para que el texto de adentro no se deforme en el camino. El
 * `DialogContent` de shadcn cuelga dos: el contenido y su botón de cerrar, así
 * que esa X quedaba fuera de la corrección y se estiraba durante toda la
 * transición. Acá se apaga el botón que trae y se vuelve a poner dentro del
 * envoltorio, que pasa a ser el único hijo.
 *
 * También aprovecha para decir "Cerrar": el del registro viene en inglés.
 *
 * El `min-w-0` no es decorativo: este envoltorio es un ítem de rejilla del
 * `DialogContent`, y un ítem de rejilla trae `min-width: auto`, o sea que no
 * baja del ancho mínimo de su contenido. Sin él, el `-mx-4` del pie —pensado
 * para cancelar el `p-4` de un padre directo— estiraba el envoltorio más ancho
 * que la tarjeta, y como es el contexto de posicionamiento de la X, la X se
 * pintaba fuera. Junto con ella se salía todo lo demás.
 */
export function MorphDialogContent({
  toProps,
  className,
  children,
}: {
  toProps: { 'data-blendy-to': string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogContent {...toProps} showCloseButton={false} {...(className ? { className } : {})}>
      <div className="relative grid min-w-0 gap-4">
        {children}

        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" className="absolute right-0 top-0">
            <XIcon />
            <span className="sr-only">Cerrar</span>
          </Button>
        </DialogClose>
      </div>
    </DialogContent>
  );
}
