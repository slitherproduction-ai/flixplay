import { Controller, Get, Headers, ParseIntPipe, Query } from '@nestjs/common';
import { AdminReadService } from './admin-read.service';

@Controller('v1/admin')
export class AdminReadController {
  constructor(private readonly service: AdminReadService) {}

  @Get('overview')
  overview(@Headers('authorization') authorization: string | undefined) {
    return this.service.overview(authorization);
  }

  @Get('customers')
  customers(@Headers('authorization') authorization: string | undefined, @Query('page', new ParseIntPipe({ optional: true })) page?: number) {
    return this.service.customers(authorization, page ?? 1);
  }

  @Get('licenses')
  licenses(@Headers('authorization') authorization: string | undefined, @Query('page', new ParseIntPipe({ optional: true })) page?: number) {
    return this.service.licenses(authorization, page ?? 1);
  }
}
