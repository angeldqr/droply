import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../http/public.decorator';

// Las sondas las consulta el orquestador, que no tiene sesión.
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: el proceso responde. No toca dependencias. */
  @Get()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: además hay base de datos del otro lado. */
  @Get('ready')
  async ready(): Promise<{ status: 'ok' | 'degraded'; database: boolean }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: true };
    } catch {
      return { status: 'degraded', database: false };
    }
  }
}
