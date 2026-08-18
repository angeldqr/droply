'use client';

import { createBlendy, type Blendy } from 'blendy';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Techo para la animación de cierre. Blendy corre sobre `requestAnimationFrame`
 * y avisa por callback cuándo terminó; si ese aviso no llega —pestaña en
 * segundo plano, o un elemento que no pudo medir— el diálogo se quedaría
 * abierto sin forma de cerrarlo. Pasado este tiempo se cierra igual.
 */
const CIERRE_MAXIMO_MS = 600;

/**
 * Conecta un diálogo de shadcn con la transición de Blendy: el contenido nace
 * del propio botón que lo abrió y vuelve a él al cerrarse, en vez de aparecer
 * y desaparecer en el centro de la pantalla.
 *
 * Radix sigue encargándose de lo que importa para poder usarlo —foco atrapado,
 * Escape, roles— y Blendy solo del movimiento. Por eso el cierre no llama a
 * `setOpen(false)` de inmediato: primero corre la animación y recién en su
 * callback se desmonta, si no el elemento desaparecería antes de animarse.
 *
 * La instancia es por diálogo y no una compartida para toda la aplicación.
 * Blendy registra los elementos de origen una vez y, para un id que ya conoce,
 * nunca vuelve a leer el nodo; al navegar entre páginas React reemplaza los
 * botones y una instancia compartida terminaría midiendo nodos desprendidos.
 */
export function useMorphDialog(id: string) {
  const [open, setOpen] = useState(false);
  const blendy = useRef<Blendy | null>(null);
  const respaldo = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarRespaldo = useCallback(() => {
    if (!respaldo.current) return;

    clearTimeout(respaldo.current);
    respaldo.current = null;
  }, []);

  useEffect(() => {
    // Quien pide menos movimiento no quiere que nada crezca ni se desplace por
    // la pantalla. La regla CSS no alcanza: Blendy anima desde JavaScript y
    // seguiría corriendo igual, así que en ese caso no se instancia.
    //
    // Se escucha el cambio y no se lee una sola vez al montar: la preferencia
    // sale de un ajuste del sistema operativo que se puede tocar con la
    // aplicación abierta, y leerla una vez obliga a recargar para que sirva.
    const preferencia = window.matchMedia('(prefers-reduced-motion: reduce)');

    const aplicar = () => {
      blendy.current = preferencia.matches ? null : createBlendy({ animation: 'dynamic' });
    };

    aplicar();
    preferencia.addEventListener('change', aplicar);

    return () => {
      preferencia.removeEventListener('change', aplicar);
      blendy.current = null;
    };
  }, []);

  useEffect(() => cancelarRespaldo, [cancelarRespaldo]);

  useEffect(() => {
    if (!open) return;

    // El contenido acaba de montarse; `update` vuelve a leer el DOM para que
    // Blendy encuentre el destino recién agregado.
    blendy.current?.update();
    blendy.current?.toggle(id);
  }, [open, id]);

  const openDialog = useCallback(() => {
    // Reabrir antes de que termine el cierre anterior dejaría vivo aquel
    // temporizador, que cerraría de golpe el diálogo recién abierto.
    cancelarRespaldo();
    setOpen(true);
  }, [cancelarRespaldo]);

  const close = useCallback(() => {
    cancelarRespaldo();

    if (!blendy.current) {
      setOpen(false);

      return;
    }

    const cerrar = () => {
      cancelarRespaldo();
      setOpen(false);
    };

    respaldo.current = setTimeout(cerrar, CIERRE_MAXIMO_MS);
    blendy.current.untoggle(id, cerrar);
  }, [id, cancelarRespaldo]);

  return {
    open,
    openDialog,
    close,
    /** Para el elemento que dispara: de ahí sale la transición. */
    fromProps: { 'data-blendy-from': id } as const,
    /** Para el contenido del diálogo: ahí termina. */
    toProps: { 'data-blendy-to': id } as const,
    /** Radix también cierra con Escape y clic afuera; pasa por acá igual. */
    onOpenChange: useCallback(
      (next: boolean) => {
        if (next) openDialog();
        else close();
      },
      [openDialog, close],
    ),
  };
}
