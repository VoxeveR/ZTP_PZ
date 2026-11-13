import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createApplication } from './app';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  const host = config.getOrThrow<string>('HOST');
  await app.listen(port, host);
  logger.log(`Products API: http://127.0.0.1:${port}/api/v1/products`);
  logger.log(`Swagger: http://127.0.0.1:${port}/docs`);
}

void bootstrap().catch((error: unknown) => {
  logger.error(
    'Application startup failed',
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  process.exitCode = 1;
});
