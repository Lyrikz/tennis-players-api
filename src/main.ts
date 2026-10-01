import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadConfig } from './config/app.config';
import { loadEnvFile } from './config/env-file';
import { API_PREFIX, configureApp, DOCS_PATH } from './app.setup';

async function bootstrap(): Promise<void> {
  loadEnvFile();
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule));
  app.enableShutdownHooks();

  const { port } = loadConfig();
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Swagger UI on http://localhost:${port}/${DOCS_PATH}`);
}

void bootstrap();
