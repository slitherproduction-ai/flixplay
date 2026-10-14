import { Controller, Get, Headers } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LicensesService } from './licenses.service';

@Controller('v1')
export class LicensesController {
  constructor(
    private readonly licenses: LicensesService,
    private readonly auth: AuthService,
  ) {}

  @Get('plans')
  getPlans() {
    return this.licenses.listPlans();
  }

  @Get('licenses/mine')
  async getMine(@Headers('authorization') authorization: string | undefined) {
    const userId = await this.auth.authenticate(authorization);
    return this.licenses.listForCustomer(userId);
  }
}
