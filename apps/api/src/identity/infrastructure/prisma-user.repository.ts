import { Prisma, type User as UserRow } from '@prisma/client';
import type { PrismaService } from '../../platform/prisma/prisma.service';
import { UserId } from '../../shared/identifiers';
import { Email } from '../domain/email';
import { EmailAlreadyRegistered } from '../domain/errors';
import type { UserRepository } from '../domain/ports';
import { User } from '../domain/user';

/** Postgres devuelve este código cuando se viola un índice único. */
const UNIQUE_VIOLATION = 'P2002';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.value } });

    return row ? toDomain(row) : null;
  }

  async findById(id: UserId): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });

    return row ? toDomain(row) : null;
  }

  async add(user: User): Promise<void> {
    const snapshot = user.toSnapshot();

    try {
      await this.prisma.user.create({
        data: {
          id: snapshot.id,
          email: snapshot.email.value,
          passwordHash: snapshot.passwordHash,
          displayName: snapshot.displayName,
          role: snapshot.role,
          timezone: snapshot.timezone,
          emailVerifiedAt: snapshot.emailVerifiedAt,
          createdAt: snapshot.createdAt,
        },
      });
    } catch (error) {
      // Acá es donde se decide de verdad la unicidad del correo. El chequeo
      // previo del caso de uso solo mejora el mensaje en el caso normal; dos
      // registros simultáneos con el mismo correo llegan hasta este punto.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new EmailAlreadyRegistered();
      }

      throw error;
    }
  }

  async save(user: User): Promise<void> {
    const snapshot = user.toSnapshot();

    await this.prisma.user.update({
      where: { id: snapshot.id },
      data: {
        passwordHash: snapshot.passwordHash,
        displayName: snapshot.displayName,
        role: snapshot.role,
        timezone: snapshot.timezone,
        emailVerifiedAt: snapshot.emailVerifiedAt,
        deactivatedAt: snapshot.deactivatedAt,
      },
    });
  }

  async remove(id: UserId): Promise<void> {
    // Bibliotecas, destinatarios, horarios y sesiones se van por cascada.
    await this.prisma.user.deleteMany({ where: { id } });
  }

  countActiveAdmins(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'ADMIN', deactivatedAt: null } });
  }
}

/**
 * Lo que hay en la base ya pasó por el dominio al entrar, así que se
 * reconstruye sin volver a validar. Si el correo guardado fuera inválido, el
 * problema sería de integridad de datos y no algo que el usuario pueda
 * corregir: por eso revienta en vez de devolver un `Result`.
 */
function toDomain(row: UserRow): User {
  const email = Email.create(row.email);

  if (!email.ok) {
    throw new Error(`El usuario ${row.id} tiene un correo inválido en la base.`);
  }

  return User.fromSnapshot({
    id: UserId.from(row.id),
    email: email.value,
    passwordHash: row.passwordHash,
    displayName: row.displayName,
    role: row.role,
    timezone: row.timezone,
    emailVerifiedAt: row.emailVerifiedAt,
    deactivatedAt: row.deactivatedAt,
    createdAt: row.createdAt,
  });
}
