'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MorphDialogContent } from '@/components/morph-dialog-content';
import { SignInForm } from '@/components/sign-in-form';
import { SignUpForm } from '@/components/sign-up-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMorphDialog } from '@/lib/morph-dialog';

type Modo = 'entrar' | 'crear-cuenta';

/**
 * Entrar y crear cuenta desde la portada, sin cambiar de página: el diálogo
 * crece desde el botón que se tocó y vuelve a él al cerrarse, así que cerrar ya
 * es volver al inicio, con el mismo movimiento pero al revés.
 *
 * Las dos formas viven en el mismo diálogo y se cambia entre ellas con
 * pestañas. Antes eran dos pantallas enlazadas una a la otra, que acá obligaría
 * a cerrar un diálogo y abrir el otro: dos animaciones encadenadas para algo
 * que es un solo gesto.
 *
 * `/entrar` y `/crear-cuenta` siguen existiendo, porque a esas direcciones se
 * llega desde un marcador o desde la redirección de una sesión vencida.
 */
export function AuthDialog({ modo }: { modo: Modo }) {
  // El id de la transición es el modo: son dos botones distintos en la misma
  // página y cada uno tiene que ser el origen del suyo.
  const dialog = useMorphDialog(modo);
  const [activo, setActivo] = useState<Modo>(modo);
  const router = useRouter();

  const entrar = () => {
    // Cerrar antes de navegar deja el botón como estaba: mientras el diálogo
    // está abierto, Blendy lo mantiene invisible.
    dialog.close();
    router.push('/bibliotecas');
  };

  return (
    <Dialog
      open={dialog.open}
      onOpenChange={(next) => {
        // Abrir siempre arranca en la pestaña del botón que se tocó, aunque la
        // vez anterior se hubiera dejado en la otra.
        if (next) setActivo(modo);
        dialog.onOpenChange(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="lg"
          variant={modo === 'crear-cuenta' ? 'default' : 'outline'}
          {...dialog.fromProps}
        >
          {/* Blendy necesita que el contenido cuelgue de un solo elemento. */}
          <span>{modo === 'crear-cuenta' ? 'Crear cuenta' : 'Entrar'}</span>
        </Button>
      </DialogTrigger>

      <MorphDialogContent toProps={dialog.toProps} className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Entrar o crear cuenta</DialogTitle>
          <DialogDescription>Elige entre entrar con tu cuenta o crear una nueva.</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activo}
          onValueChange={(valor) => setActivo(valor === 'crear-cuenta' ? 'crear-cuenta' : 'entrar')}
        >
          <TabsList className="mx-auto">
            <TabsTrigger value="entrar" className="text-foreground/80">
              Entrar
            </TabsTrigger>
            <TabsTrigger value="crear-cuenta" className="text-foreground/80">
              Crear cuenta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entrar" className="pt-6">
            <SignInForm onDone={entrar} />
          </TabsContent>

          <TabsContent value="crear-cuenta" className="pt-6">
            <SignUpForm onDone={entrar} />
          </TabsContent>
        </Tabs>
      </MorphDialogContent>
    </Dialog>
  );
}
