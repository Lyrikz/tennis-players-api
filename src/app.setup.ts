import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { API_KEY_HEADER, API_KEY_SECURITY_SCHEME } from './common/guards/api-key.guard';
import { API_PREFIX } from './common/http/api-prefix';

export { API_PREFIX };
export const DOCS_PATH = 'docs';

/**
 * Cross-cutting HTTP configuration, shared by the local server, the Lambda
 * handler and the e2e tests so that all three behave identically.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.disable('x-powered-by');
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Tennis Players API')
      .setDescription('Tennis players and statistics')
      .setVersion('1.0.0')
      .addApiKey(
        { type: 'apiKey', in: 'header', name: API_KEY_HEADER, description: 'Required for writes' },
        API_KEY_SECURITY_SCHEME,
      )
      .build(),
  );
  SwaggerModule.setup(DOCS_PATH, app, document, { jsonDocumentUrl: `${DOCS_PATH}/json` });

  return app;
}
