import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DevicePlatform } from '@prisma/client';
import { DevicesService } from './devices.service';

class RegisterDeviceDto {
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post('register')
  async register(@Body() body: RegisterDeviceDto) {
    return this.devices.register(body.platform, body.displayName);
  }

  @Post(':id/pairing')
  @HttpCode(HttpStatus.OK)
  async startPairing(@Param('id') id: string, @Headers('authorization') auth: string | undefined) {
    return this.devices.startPairing(id, auth);
  }
}
