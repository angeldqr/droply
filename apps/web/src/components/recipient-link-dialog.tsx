'use client';

import type { RecipientView } from '@droply/contracts';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
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
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

/**
 * El enlace que hay que hacerle llegar al destinatario.
 *
 * Se muestra aparte y no dentro de la lista porque es lo único que hay que
 * hacer después de crear a alguien, y porque el código en claro solo existe en
 * esta respuesta: la lista no puede volver a mostrarlo.
 *
 * Explica el porqué en vez de solo dar el enlace. Un bot de Telegram no puede
 * escribirle a quien nunca le habló, así que el paso de la otra persona no es
 * un trámite que se pueda saltar, y quien no lo sabe cree que la aplicación
 * está rota.
 */
export function RecipientLinkDialog({
  recipient,
  onOpenChange,
}: {
  recipient: RecipientView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!recipient?.linkUrl) return;

    try {
      await navigator.clipboard.writeText(recipient.linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el enlace sigue a la vista y seleccionable.
      toast.error('No pudimos copiarlo. Selecciónalo y cópialo a mano.');
    }
  }

  return (
    <Dialog open={recipient !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Envíale este enlace a {recipient?.label}</DialogTitle>
          <DialogDescription>
            Tiene que abrirlo y apretar <strong>Empezar</strong> en Telegram. Hasta entonces el bot
            no puede escribirle: así funciona Telegram, no es algo que podamos saltarnos.
          </DialogDescription>
        </DialogHeader>

        <InputGroup>
          <InputGroupInput readOnly value={recipient?.linkUrl ?? ''} aria-label="Enlace" />
          <InputGroupAddon align="inline-end">
            <Button variant="ghost" size="icon-sm" onClick={() => void copy()} aria-label="Copiar">
              {copied ? <Check /> : <Copy />}
            </Button>
          </InputGroupAddon>
        </InputGroup>

        <p className="text-muted-foreground text-sm">
          Vence en un día, y reemplaza a cualquier otro enlace que hayas mandado antes para{' '}
          {recipient?.label}: ese ya no funciona.
        </p>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
