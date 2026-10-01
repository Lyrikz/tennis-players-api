import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './app.factory';

describe('Health & docs (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health reports the service as up', async () => {
    const { body } = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(body).toEqual({ status: 'ok', uptime: expect.any(Number) });
  });

  it('does not advertise the underlying framework', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('GET /docs serves the Swagger UI', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200).expect('Content-Type', /html/);
  });

  it('GET /docs/json serves an OpenAPI document describing every endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/docs/json').expect(200);
    const body = response.body as {
      openapi: string;
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
    };

    expect(body.openapi).toMatch(/^3\./);
    expect(Object.keys(body.paths).sort()).toEqual([
      '/api/v1/health',
      '/api/v1/players',
      '/api/v1/players/{id}',
      '/api/v1/stats',
    ]);
    expect(body.components.securitySchemes).toEqual({
      'api-key': expect.objectContaining({ type: 'apiKey', in: 'header', name: 'x-api-key' }),
    });
    expect(Object.keys(body.components.schemas)).toEqual(
      expect.arrayContaining([
        'PlayerResponseDto',
        'CreatePlayerRequestDto',
        'StatsResponseDto',
        'ErrorResponseDto',
      ]),
    );
  });
});
