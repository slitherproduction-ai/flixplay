import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { IsUUID, Equals } from 'class-validator';
import { AdminLicensesService } from './admin-licenses.service';

class ConfirmationDto {
  @Equals('CONFIRMAR_OPERACAO_TESTE')
  confirmation!: string;
}

class IssueDto extends ConfirmationDto {
  @IsUUID()
  deviceId!: string;
}

@Controller('v1/internal/test-licenses')
export class AdminLicensesController {
  constructor(private readonly service: AdminLicensesService) {}

  @Post('issue')
  issue(@Headers('authorization') auth: string | undefined, @Body() body: IssueDto) {
    return this.service.issue(auth, body.deviceId);
  }

  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  renew(@Headers('authorization') auth: string | undefined, @Param('id') id: string, @Body() body: ConfirmationDto) {
    if (body.confirmation !== 'CONFIRMAR_OPERACAO_TESTE') throw new Error('Confirmation required');
    return this.service.renew(auth, id);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(@Headers('authorization') auth: string | undefined, @Param('id') id: string, @Body() body: ConfirmationDto) {
    if (body.confirmation !== 'CONFIRMAR_OPERACAO_TESTE') throw new Error('Confirmation required');
    return this.service.revoke(auth, id);
  }
}
