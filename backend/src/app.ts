import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ShutdownSignal } from '@nestjs/common';
import { AppModule } from './app.module';
import { OpenApiService } from './infrastructure/openapi/openapi.service';
import { BodyValidationPipe } from './infrastructure/http/body-validation.pipe';

export async function createApplication() {
  const app = await NestFactory.create(AppModule, { return503OnClosing: true });
  app.enableShutdownHooks([ShutdownSignal.SIGINT, ShutdownSignal.SIGTERM]);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new BodyValidationPipe());
  app.enableCors({
    origin: app.get(ConfigService).getOrThrow<string>('CORS_ORIGIN'),
  });

  app.get(OpenApiService).setup(app);
  return app;
}
