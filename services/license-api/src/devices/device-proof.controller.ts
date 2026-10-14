import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { DeviceProofService } from './device-proof.service';
import { DeviceEntitlementService } from '../licenses/device-entitlement.service';

class RegisterProofKeyDto {
  @IsString() @MinLength(50) @MaxLength(1000)
  publicKeyPem!: string;
}
class ProofDto {
  @IsString() @MinLength(43) @MaxLength(43)
  nonce!: string;
  @IsString() @MinLength(86) @MaxLength(86)
  signature!: string;
}

@Controller('v1/devices')
export class DeviceProofController {
  constructor(private readonly proof: DeviceProofService, private readonly entitlement: DeviceEntitlementService) {}

  @Post(':id/proof-key')
  @HttpCode(HttpStatus.OK)
  register(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() body: RegisterProofKeyDto) {
    return this.proof.registerKey(id, auth, body.publicKeyPem);
  }

  @Post(':id/challenge')
  @HttpCode(HttpStatus.OK)
  challenge(@Param('id') id: string, @Headers('authorization') auth: string | undefined) {
    return this.proof.challenge(id, auth);
  }

  @Post(':id/entitlement/proof')
  @HttpCode(HttpStatus.OK)
  async validate(@Param('id') id: string, @Headers('authorization') auth: string | undefined, @Body() body: ProofDto) {
    await this.proof.consume(id, auth, body.nonce, body.signature);
    return this.entitlement.getEntitlement(id, auth, true);
  }
}
