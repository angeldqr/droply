import { Module } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { ACCOUNT_DIRECTORY } from '../domain/ports';
import { PrismaAccountDirectory } from '../infrastructure/prisma-account.directory';
import { AdminController } from './admin.controller';

@Module({
  controllers: [AdminController],
  providers: [
    {
      provide: ACCOUNT_DIRECTORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAccountDirectory(prisma),
    },
  ],
})
export class AdminModule {}
