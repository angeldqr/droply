'use client';

import type { UploadTicketView } from '@droply/contracts';

/**
 * Manda el archivo al almacenamiento, no al API.
 *
 * Va aparte de `lib/api.ts` a propósito: es otro host, y no lleva ni la cabecera
 * de autorización ni la cookie de sesión. El permiso viene firmado desde el API
 * y se agota solo.
 *
 * Con `XMLHttpRequest` y no con `fetch` porque `fetch` no avisa cuánto lleva
 * subido, y con archivos de cincuenta megas la barra es la diferencia entre
 * esperar y pensar que se colgó.
 */
export function uploadToStorage(
  ticket: UploadTicketView,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();

    // El orden importa: el almacenamiento lee la política de los campos y
    // rechaza lo que venga después del archivo.
    for (const [name, value] of Object.entries(ticket.fields)) form.append(name, value);
    form.append('file', file);

    const request = new XMLHttpRequest();

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });

    request.addEventListener('load', () => {
      // El almacenamiento responde 204 cuando acepta. Un 4xx acá casi siempre
      // es la política: el archivo pesa más de lo que el permiso autorizó.
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error('El almacenamiento no aceptó el archivo.'));
      }
    });

    request.addEventListener('error', () =>
      reject(new Error('Se cortó la conexión con el almacenamiento.')),
    );
    request.addEventListener('abort', () => reject(new Error('Se canceló la subida.')));

    request.open('POST', ticket.url);
    request.send(form);
  });
}
