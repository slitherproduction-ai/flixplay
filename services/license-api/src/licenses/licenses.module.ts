import { DeviceProofController } from '../devices/device-proof.controller';
import { DeviceProofService } from '../devices/device-proof.service';
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
  controllers: [LicensesController, AdminLicensesController, DeviceEntitlementController, DeviceProofController],
  providers: [LicensesService, AdminLicensesService, DeviceEntitlementService, DeviceProofService, PrismaService],
})
export class LicensesModule {}
