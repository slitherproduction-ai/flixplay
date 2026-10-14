import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../database/prisma.service';
import { AdminLicensesController } from './admin-licenses.controller';
import { AdminLicensesService } from './admin-licenses.service';
import { DeviceEntitlementController } from './device-entitlement.controller';
import { DeviceEntitlementService } from './device-entitlement.service';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

@Module({
  imports: [AuthModule],
  controllers: [LicensesController, AdminLicensesController, DeviceEntitlementController],
  providers: [LicensesService, AdminLicensesService, DeviceEntitlementService, PrismaService],
})
export class LicensesModule {}
