import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AdminMfaRecoveryController } from './admin-mfa-recovery.controller';
import { AdminMfaRecoveryService } from './admin-mfa-recovery.service';
import { AdminMfaController } from './admin-mfa.controller';
import { AdminMfaService } from './admin-mfa.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController, AdminMfaController, AdminMfaRecoveryController],
  providers: [AuthService, AdminMfaService, AdminMfaRecoveryService, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
