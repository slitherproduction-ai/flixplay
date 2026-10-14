import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsUUID, IsString, Matches } from 'class-validator';
import { AdminMfaRecoveryService } from './admin-mfa-recovery.service';
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
  @Post(':id/approve') @HttpCode(HttpStatus.OK)
  approve(@Headers('authorization') header: string | undefined, @Param('id') id: string) {
    return this.service.approve(header, id);
  }
}
