import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';

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
    return { status: 'ok', service: 'elvanoq-license-api', version: '0.1.0' };
  }
}

@Module({ controllers: [HealthController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.enableCors({ origin: env.CORS_ORIGINS.split(',').map(x => x.trim()), credentials: false });
  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
}
bootstrap().catch((error: unknown) => {
  console.error('ELVANOQ API failed to start', error);
  process.exitCode = 1;
});
