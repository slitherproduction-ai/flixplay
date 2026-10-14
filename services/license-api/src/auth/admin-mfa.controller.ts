import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { AdminMfaService } from './admin-mfa.service';

class MfaCodeDto {
  @IsString()
  @Matches(/^[0-9]{6}$/)
  code!: string;
}
@Controller('v1/auth/admin-mfa')
export class AdminMfaController {
  constructor(private readonly service: AdminMfaService) {}
  @Post('enroll')
  @HttpCode(HttpStatus.OK)
  enroll(@Headers('authorization') authorization: string | undefined) {
    return this.service.enroll(authorization);
  }
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  revokeOtherSessions(@Headers('authorization') authorization: string | undefined) {
    return this.service.revokeOtherSessions(authorization);
  }

  @Post('credential/revoke')
  @HttpCode(HttpStatus.OK)
  revokeCredential(@Headers('authorization') authorization: string | undefined) {
    return this.service.revokeOwnCredential(authorization);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Headers('authorization') authorization: string | undefined, @Body() body: MfaCodeDto) {
    return this.service.verify(authorization, body.code);
  }
}
