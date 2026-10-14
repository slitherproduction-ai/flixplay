import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { AdminLicensesController } from './admin-licenses.controller';
import { AdminLicensesService } from './admin-licenses.service';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

@Module({
  imports: [AuthModule],
  controllers: [LicensesController, AdminLicensesController],
  providers: [LicensesService, AdminLicensesService, PrismaService],
})
export class LicensesModule {}
