import { Controller, Get, Headers, Param } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { DeviceEntitlementService } from './device-entitlement.service';

@Controller('v1/devices')
export class DeviceEntitlementController {
  constructor(private readonly entitlements: DeviceEntitlementService) {}

  @Get(':id/entitlement')
  get(@Param('id') id: string, @Headers('authorization') authorization: string | undefined) {
    return this.entitlements.getEntitlement(id, authorization);
  }
}
