import { Module } from '@nestjs/common';
import { EnvModule } from './config/env.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { KernelModule } from './system/kernel.module';

@Module({
  imports: [EnvModule, PrismaModule, KernelModule],
  controllers: [HealthController],
})
export class PlatformModule {}
