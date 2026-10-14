import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsUUID, IsString, Matches } from 'class-validator';
import { AdminMfaRecoveryService } from './admin-mfa-recovery.service';
class GrantDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) grant!: string;
}
class RequestDto {
  @IsUUID() targetUserId!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{12,100}$/) evidenceReference!: string;
}
@Controller('v1/internal/admin-mfa-recovery')
export class AdminMfaRecoveryController {
  constructor(private readonly service: AdminMfaRecoveryService) {}
  @Post('request') @HttpCode(HttpStatus.OK)
  request(@Headers('authorization') header: string | undefined, @Body() dto: RequestDto) {
    return this.service.request(header, dto.targetUserId, dto.evidenceReference);
  }
  @Post(':id/consume-test-grant') @HttpCode(HttpStatus.OK)
  consumeTestGrant(@Headers('authorization') header: string | undefined, @Param('id') id: string, @Body() dto: GrantDto) {
    return this.service.consumeTestGrant(header, id, dto.grant);
  }
  @Post(':id/approve') @HttpCode(HttpStatus.OK)
  approve(@Headers('authorization') header: string | undefined, @Param('id') id: string) {
    return this.service.approve(header, id);
  }
}
