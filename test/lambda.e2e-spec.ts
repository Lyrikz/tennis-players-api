import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import { NestFactory } from '@nestjs/core';
import { handler } from '../src/lambda';

/** Minimal API Gateway HTTP API (payload v2.0) event. */
function httpApiEvent(path: string, rawQueryString = ''): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString,
    headers: { host: 'api.example.com', accept: 'application/json' },
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      requestId: 'request-id',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2026:12:00:00 +0000',
      timeEpoch: 1767268800000,
      http: {
        method: 'GET',
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest',
      },
    },
  };
}

const context = { awsRequestId: 'request-id' } as Context;

async function invoke(path: string, query?: string) {
  const result = (await handler(
    httpApiEvent(path, query),
    context,
  )) as APIGatewayProxyStructuredResultV2;
  return { statusCode: result.statusCode, body: JSON.parse(result.body ?? 'null') };
}

describe('Lambda handler (e2e)', () => {
  const createApp = jest.spyOn(NestFactory, 'create');

  beforeAll(() => {
    // The handler logs Nest bootstrap messages as JSON: keep the test output clean.
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('serves the API through an API Gateway HTTP API event', async () => {
    const { statusCode, body } = await invoke('/api/v1/players', 'country=SUI');

    expect(statusCode).toBe(200);
    expect((body as { lastName: string }[]).map((player) => player.lastName)).toEqual(['Wawrinka']);
  });

  it('reuses the Nest instance across invocations and keeps the error format', async () => {
    const { statusCode, body } = await invoke('/api/v1/players/999');

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, message: 'Player with id 999 not found' });
    expect(createApp).toHaveBeenCalledTimes(1);
  });
});
