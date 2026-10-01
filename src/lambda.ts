import serverlessExpress from '@codegenie/serverless-express';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

type ProxyHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

/**
 * Bootstrapping Nest is the costly part of a cold start: the promise is kept at
 * module scope so warm invocations of the same container reuse the instance.
 */
let server: Promise<ProxyHandler> | undefined;

async function bootstrap(): Promise<ProxyHandler> {
  // JSON logs are directly queryable in CloudWatch Logs Insights.
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: new ConsoleLogger({ json: true }),
    }),
  );
  await app.init();

  // The v5 handler is promise-based, but its typings still declare the callback-style `Handler`.
  return serverlessExpress({
    app: app.getHttpAdapter().getInstance(),
  }) as unknown as ProxyHandler;
}

export const handler: ProxyHandler = async (event, context) => {
  server ??= bootstrap().catch((error: unknown) => {
    // Do not cache a failed bootstrap: let the next invocation retry.
    server = undefined;
    throw error;
  });
  return (await server)(event, context);
};
