import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { AdminReadController } from './admin-read.controller';
import { AdminReadService } from './admin-read.service';

@Module({ imports: [AuthModule], controllers: [AdminReadController], providers: [AdminReadService, PrismaService] })
export class AdminReadModule {}
