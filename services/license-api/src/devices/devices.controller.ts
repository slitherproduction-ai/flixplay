import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DevicePlatform } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { IsString as ValidateString, Length } from 'class-validator';
import { DevicesService } from './devices.service';

class RegisterDeviceDto {
  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
  @Post('claim')
  @HttpCode(HttpStatus.OK)
  async claim(@Headers('authorization') authorization: string | undefined, @Body() body: ClaimPairingDto) {
    const userId = await this.auth.authenticate(authorization);
    return this.devices.claimPairing(userId, body.code);
  }
}

class ClaimPairingDto {
  @ValidateString()
  @Length(8, 8)
  code!: string;
}

@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService, private readonly auth: AuthService) {}

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
