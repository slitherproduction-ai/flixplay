import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AdminMfaController } from './admin-mfa.controller';
import { AdminMfaService } from './admin-mfa.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController, AdminMfaController],
  providers: [AuthService, AdminMfaService, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
