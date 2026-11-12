import { COLUMN_LABELS_SINGULAR, type ItemKind } from '@reconectate/contracts';
import { clip, type AssistantSource } from '../../shared/assistant-source';
import { LibraryId } from '../../shared/identifiers';
import type { Library } from '../domain/library';
import type { LibraryItemRepository, LibraryRepository } from '../domain/ports';

/** Los elementos de una biblioteca que ve el asistente. */
const ITEMS_LIMIT = 50;

/**
 * Las bibliotecas y el baúl, para el asistente.
 *
 * Lee los repositorios y no `GetLibrary`: ese firma una URL por cada archivo, y
 * al asistente le basta saber qué hay, no poder abrirlo.
 */
export function librariesSource(
  libraries: LibraryRepository,
  items: LibraryItemRepository,
): AssistantSource {
  return {
    async list(ownerId) {
      const [rows, vault] = await Promise.all([
        libraries.listOwnedBy(ownerId),
        libraries.findVaultOf(ownerId),
      ]);

      return {
        bibliotecas: rows.map(({ library, counts }) => ({
          ...named(library),
          elementos: Object.fromEntries(
            Object.entries(counts).map(([kind, count]) => [
              COLUMN_LABELS_SINGULAR[kind as ItemKind],
              count,
            ]),
          ),
        })),
        baul: vault ? named(vault) : null,
      };
    },

    async detail(ownerId, id) {
      if (!LibraryId.is(id)) return null;

      const library = await libraries.findOwned(id, ownerId);

      if (!library) return null;

      const rows = await items.listOf(library.id);

      return {
        ...named(library),
        totalDeElementos: rows.length,
        elementos: rows.slice(0, ITEMS_LIMIT).map((item) => {
          const snapshot = item.toSnapshot();

          return {
            tipo: COLUMN_LABELS_SINGULAR[snapshot.kind],
            texto: clip(snapshot.textContent),
            archivo: snapshot.fileName,
            vecesAlDia: snapshot.timesPerDay,
          };
        }),
      };
    },
  };
}

function named(library: Library) {
  return { id: library.id, nombre: library.name, descripcion: clip(library.description) };
}
