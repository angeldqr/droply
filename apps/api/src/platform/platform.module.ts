import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [EnvModule, PrismaModule],
  controllers: [HealthController],
})
export class PlatformModule {}
