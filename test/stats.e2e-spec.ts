import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PLAYER_REPOSITORY, type PlayerRepository } from '../src/players/domain';
import { InMemoryPlayerRepository } from '../src/players/infrastructure/in-memory-player.repository';
import { createTestApp } from './app.factory';

describe('Stats (e2e)', () => {
  describe('with the bundled dataset', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/stats returns the global statistics', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/stats')
        .expect(200, {
          bestCountry: { code: 'SRB', winRatio: 1, wins: 5, matches: 5 },
          averageBmi: 23.36,
          medianHeightCm: 185,
        });
    });
  });

  describe('without any player', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      app = await createTestApp((builder) =>
        builder
          .overrideProvider(PLAYER_REPOSITORY)
          .useValue(new InMemoryPlayerRepository({ players: [] })),
      );
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/stats returns null statistics', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/stats')
        .expect(200, { bestCountry: null, averageBmi: null, medianHeightCm: null });
    });
  });

  describe('when the data source fails', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      const failingRepository: PlayerRepository = {
        findAll: () => Promise.reject(new Error('connection refused to db.internal:5432')),
        findById: () => Promise.reject(new Error('connection refused to db.internal:5432')),
        create: () => Promise.reject(new Error('connection refused to db.internal:5432')),
      };
      app = await createTestApp((builder) =>
        builder.overrideProvider(PLAYER_REPOSITORY).useValue(failingRepository),
      );
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/stats returns a 500 without leaking internals', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/v1/stats').expect(500);

      expect(body).toMatchObject({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
      expect(JSON.stringify(body)).not.toContain('db.internal');
    });
  });
});
