'use client';

import type { AccountSummaryView } from '@reconectate/contracts';
import { KeyRound, MoreHorizontal, Trash2, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { ApiError } from '@/lib/api';
import { useDeleteAccount, useResetAccountPassword, useSetAccountActive } from '@/lib/admin';
import { useSession } from '@/lib/session';

const message = (caught: unknown, fallback: string) =>
  caught instanceof ApiError ? caught.message : fallback;

/**
 * Lo que quien administra puede hacerle a una cuenta ajena.
 *
 * Las tres están detrás del menú `···` y no sueltas en la fila: son acciones
 * que se toman una vez y dos de ellas no se deshacen, así que no merecen estar
 * a un clic de distancia mientras uno recorre la lista.
 *
 * Sobre la propia cuenta no aparece ninguna: el servidor las rechaza igual,
 * pero ofrecer un botón que siempre falla es peor que no ofrecerlo.
 */
export function AccountActions({ account }: { account: AccountSummaryView }) {
  const { user } = useSession();
  const resetPassword = useResetAccountPassword();
  const setActive = useSetAccountActive();
  const remove = useDeleteAccount();

  const [temporary, setTemporary] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (user?.id === account.id) return null;

  async function onReset() {
    try {
      const result = await resetPassword.mutateAsync(account.id);

      setTemporary(result.password);
    } catch (caught) {
      toast.error(message(caught, 'No se pudo restablecer.'));
    }
  }

  function onToggleActive() {
    setActive.mutate(
      { userId: account.id, active: !account.active },
      {
        onSuccess: () =>
          toast.success(account.active ? 'Cuenta desactivada.' : 'Cuenta reactivada.'),
        onError: (error) => toast.error(message(error, 'No se pudo cambiar.')),
      },
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones de ${account.email}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => void onReset()}>
            <KeyRound /> Restablecer contraseña
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleActive}>
            {account.active ? (
              <>
                <UserX /> Desactivar
              </>
            ) : (
              <>
                <UserCheck /> Reactivar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
            <Trash2 /> Borrar la cuenta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/*
        La contraseña temporal se muestra una vez y no se puede volver a ver:
        de ella solo queda el hash. Es el mismo trato que el enlace de
        vinculación, y por eso el aviso usa las mismas palabras.
      */}
      <Dialog open={temporary !== null} onOpenChange={(open) => !open && setTemporary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña temporal</DialogTitle>
            <DialogDescription>
              Dásela a {account.displayName} y dile que la cambie desde su cuenta.
            </DialogDescription>
          </DialogHeader>

          <p className="bg-muted border-border rounded-md border px-4 py-3 text-center font-mono text-lg tracking-wider">
            {temporary}
          </p>

          <Alert>
            <AlertTitle>Cópiala ahora</AlertTitle>
            <AlertDescription>
              No se puede volver a ver: solo se guarda cifrada. Si la pierdes, restablécela otra
              vez. Las sesiones que tuviera abiertas ya se cerraron.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button onClick={() => setTemporary(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la cuenta de {account.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se van sus {account.libraryCount} bibliotecas, sus {account.recipientCount}{' '}
              destinatarios, sus {account.scheduleCount} horarios y sus archivos. No se puede
              deshacer. Si solo quieres cortarle el acceso, desactívala.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                remove.mutate(account.id, {
                  onSuccess: () => toast.success('Cuenta borrada.'),
                  onError: (error) => toast.error(message(error, 'No se pudo borrar.')),
                })
              }
              disabled={remove.isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {remove.isPending ? <Spinner /> : null}
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
