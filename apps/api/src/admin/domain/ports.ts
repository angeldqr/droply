import type { UserId } from '../../shared/identifiers';

/**
 * Lo que un administrador puede ver de una cuenta: cuánto hay, no qué hay.
 *
 * Ni el texto de un elemento ni una URL de descarga aparecen por acá, y es
 * deliberado: administrar es saber si alguien está usando el producto y con qué
 * volumen, no leerle los mensajes ni abrirle las fotos. El baúl es lo más
 * personal que hay en la aplicación y por eso solo se cuenta.
 */
export interface AccountSummary {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly emailVerified: boolean;
  /** Si puede entrar. Una cuenta desactivada conserva todo lo suyo. */
  readonly active: boolean;
  readonly createdAt: Date;
  readonly libraryCount: number;
  readonly recipientCount: number;
  readonly scheduleCount: number;
  readonly vaultItemCount: number;
}

export interface AccountDetail extends AccountSummary {
  readonly libraries: readonly {
    readonly id: string;
    readonly name: string;
    readonly description: string | null;
    readonly itemCount: number;
    readonly recipientCount: number;
  }[];
  readonly recipients: readonly {
    readonly id: string;
    readonly label: string;
    readonly linked: boolean;
  }[];
}

export interface AccountDirectory {
  list(): Promise<AccountSummary[]>;
  find(userId: UserId): Promise<AccountDetail | null>;
}

export const ACCOUNT_DIRECTORY = Symbol('AccountDirectory');
