import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { PlayerResponseDto } from '../src/players/presentation/dto/player-response.dto';
import { createTestApp } from './app.factory';

const idsOf = (body: unknown): number[] => (body as PlayerResponseDto[]).map((player) => player.id);

const ERROR_SHAPE = {
  statusCode: expect.any(Number),
  error: expect.any(String),
  message: expect.any(String),
  path: expect.any(String),
  timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
};

describe('Players (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/players', () => {
    it('lists players from best to worst official rank', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/players')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(idsOf(body)).toEqual([17, 52, 102, 65, 95]);
      expect((body as PlayerResponseDto[]).map((player) => player.stats.rank)).toEqual([
        1, 2, 10, 21, 52,
      ]);
    });

    it('exposes players with explicit units', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/v1/players').expect(200);

      expect(body[1]).toEqual({
        id: 52,
        firstName: 'Novak',
        lastName: 'Djokovic',
        shortName: 'N.DJO',
        sex: 'M',
        country: { code: 'SRB', pictureUrl: 'https://tenisu.latelier.co/resources/Serbie.png' },
        pictureUrl: 'https://tenisu.latelier.co/resources/Djokovic.png',
        stats: {
          rank: 2,
          points: 2542,
          weightKg: 80,
          heightCm: 188,
          age: 31,
          lastResults: [1, 1, 1, 1, 1],
        },
      });
    });

    it('filters by sex, case-insensitively', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/players')
        .query({ sex: 'f' })
        .expect(200);

      expect(idsOf(body)).toEqual([102, 95]);
    });

    it('filters by country and sex', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/players')
        .query({ sex: 'M', country: 'srb' })
        .expect(200);

      expect(idsOf(body)).toEqual([52]);
    });

    it('returns an empty list when no player matches', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/players')
        .query({ country: 'FRA' })
        .expect(200, []);
    });

    it.each([
      [{ sex: 'X' }, 'sex must be one of the following values: M, F'],
      [{ country: 'SERBIA' }, 'country must be an ISO 3166-1 alpha-3 code (e.g. SRB)'],
      [{ unknown: 'value' }, 'property unknown should not exist'],
    ])('rejects invalid query %p with a 400', async (query, detail) => {
      const { body } = await request(app.getHttpServer())
        .get('/api/v1/players')
        .query(query)
        .expect(400);

      expect(body).toMatchObject({ ...ERROR_SHAPE, statusCode: 400, message: 'Validation failed' });
      expect(body.details).toContain(detail);
    });

    it('rejects a repeated filter with a 400', async () => {
      await request(app.getHttpServer()).get('/api/v1/players?sex=M&sex=F').expect(400);
    });
  });

  describe('GET /api/v1/players/:id', () => {
    it('returns the player', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/v1/players/17').expect(200);

      expect(body).toMatchObject({ id: 17, lastName: 'Nadal', stats: { rank: 1 } });
    });

    it('returns a 404 when the player does not exist', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/v1/players/999').expect(404);

      expect(body).toEqual({
        ...ERROR_SHAPE,
        statusCode: 404,
        error: 'Not Found',
        message: 'Player with id 999 not found',
        path: '/api/v1/players/999',
      });
    });

    it.each(['abc', '0', '-1', '1.5'])('returns a 400 when id is %p', async (id) => {
      const { body } = await request(app.getHttpServer()).get(`/api/v1/players/${id}`).expect(400);

      expect(body).toEqual({
        ...ERROR_SHAPE,
        statusCode: 400,
        error: 'Bad Request',
        message: 'id must be a positive integer',
      });
    });
  });

  describe('unknown routes', () => {
    it('return a 404 with the uniform error format', async () => {
      const { body } = await request(app.getHttpServer()).delete('/api/v1/players/17').expect(404);

      expect(body).toMatchObject({ ...ERROR_SHAPE, message: 'Cannot DELETE /api/v1/players/17' });
    });
  });
});
