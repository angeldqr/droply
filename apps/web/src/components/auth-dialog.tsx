'use client';

import { useRouter } from 'next/navigation';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { SignInForm } from '@/components/sign-in-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useMorphDialog } from '@/lib/morph-dialog';

/**
 * Entrar desde la portada sin cambiar de página: el diálogo crece desde el
 * botón que se tocó y vuelve a él al cerrarse, así que cerrar ya es volver al
 * inicio, con el mismo movimiento pero al revés.
 *
 * Antes tenía dos pestañas, entrar y crear cuenta. La segunda se fue cuando las
 * cuentas pasaron a crearlas quien administra: dejar la pestaña sería ofrecer
 * una puerta que el servidor rechaza.
 *
 * `/entrar` sigue existiendo, porque a esa dirección se llega desde un marcador
 * o desde la redirección de una sesión vencida.
 */
export function AuthDialog({ modo }: { modo: 'entrar' }) {
  const dialog = useMorphDialog(modo);
  const router = useRouter();

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" {...dialog.fromProps}>
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span>Entrar</span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps} className="sm:max-w-md">
        <div>
          <DialogHeader className="sr-only">
            <DialogTitle>Entrar</DialogTitle>
            <DialogDescription>Entra con tu cuenta de Reconéctate.</DialogDescription>
          </DialogHeader>

          <SignInForm
            onDone={() => {
              // Cerrar antes de navegar deja el botón como estaba: mientras el
              // diálogo está abierto, Blendy lo mantiene invisible.
              dialog.close();
              router.push('/bibliotecas');
            }}
          />
        </div>
      </MorphDialogContent>
    </Dialog>
  );
}
