import 'reflect-metadata';
import { Controller, Get, Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestFactory } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiThrottlingModule } from './security/api-throttling.module';
import { z } from 'zod';
import { AuthModule } from './auth/auth.module';
import { AdminReadModule } from './admin/admin-read.module';
import { LicensesModule } from './licenses/licenses.module';
import { DevicesModule } from './devices/devices.module';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z.string().min(1),
});
const env = envSchema.parse(process.env);

@Controller('v1')
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'elvanoq-license-api', version: '0.2.0' };
  }
}

@Module({
  imports: [
    ApiThrottlingModule,
    DevicesModule,
    AuthModule,
    AdminReadModule,
    LicensesModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: env.CORS_ORIGINS.split(',').map(x => x.trim()), credentials: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
}
bootstrap().catch((error: unknown) => {
  console.error('ELVANOQ API failed to start', error);
  process.exitCode = 1;
});
