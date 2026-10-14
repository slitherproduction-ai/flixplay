import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({ controllers: [DevicesController], providers: [DevicesService, PrismaService] })
export class DevicesModule {}
