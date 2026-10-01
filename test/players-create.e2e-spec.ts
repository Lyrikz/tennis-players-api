import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './app.factory';
import { TEST_API_KEY } from './setup-env';

const alcaraz = () => ({
  firstName: 'Carlos',
  lastName: 'Alcaraz',
  shortName: 'C.ALC',
  sex: 'M',
  country: { code: 'ESP', pictureUrl: 'https://tenisu.latelier.co/resources/Espagne.png' },
  pictureUrl: 'https://tenisu.latelier.co/resources/Alcaraz.png',
  stats: {
    rank: 3,
    points: 2000,
    weightKg: 74,
    heightCm: 183,
    age: 21,
    lastResults: [1, 1, 1, 1, 1],
  },
});

describe('POST /api/v1/players (e2e)', () => {
  let app: INestApplication<App>;

  // A fresh application per test: creations must not leak between tests.
  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  /** `apiKey: null` sends no key at all. */
  const post = (body: unknown, apiKey: string | null = TEST_API_KEY) => {
    const req = request(app.getHttpServer()).post('/api/v1/players');
    return (apiKey === null ? req : req.set('x-api-key', apiKey)).send(body as object);
  };

  describe('with a valid API key', () => {
    it('creates the player: 201, Location header and the created resource', async () => {
      const response = await post(alcaraz()).expect(201).expect('Content-Type', /json/);

      expect(response.headers.location).toBe('/api/v1/players/103');
      expect(response.body).toEqual({ id: 103, ...alcaraz() });
    });

    it('makes the player available at its Location', async () => {
      const { headers } = await post(alcaraz()).expect(201);

      const { body } = await request(app.getHttpServer())
        .get(headers.location as string)
        .expect(200);

      expect(body).toMatchObject({ id: 103, lastName: 'Alcaraz' });
    });

    it('inserts the player in the ranking and in the statistics', async () => {
      await post(alcaraz()).expect(201);

      const { body: players } = await request(app.getHttpServer())
        .get('/api/v1/players')
        .expect(200);
      const { body: stats } = await request(app.getHttpServer()).get('/api/v1/stats').expect(200);

      expect((players as { id: number }[]).map(({ id }) => id)).toEqual([17, 52, 103, 102, 65, 95]);
      expect(stats).toMatchObject({ medianHeightCm: 184, averageBmi: 23.15 });
    });

    it('assigns distinct ids to successive players', async () => {
      const first = await post(alcaraz()).expect(201);
      const second = await post({ ...alcaraz(), firstName: 'Carlitos' }).expect(201);

      expect([first.body.id, second.body.id]).toEqual([103, 104]);
    });

    it('normalises case-insensitive fields', async () => {
      const { body } = await post({
        ...alcaraz(),
        sex: 'm',
        country: { ...alcaraz().country, code: 'esp' },
      }).expect(201);

      expect(body).toMatchObject({ sex: 'M', country: { code: 'ESP' } });
    });

    it.each<[string, unknown, string]>([
      ['an empty body', {}, 'firstName should not be empty'],
      ['an id chosen by the client', { ...alcaraz(), id: 1 }, 'property id should not exist'],
      [
        'a weight in grams',
        { ...alcaraz(), stats: { ...alcaraz().stats, weightKg: 74000 } },
        'stats.weightKg must not be greater than 200',
      ],
      [
        'an invalid match result',
        { ...alcaraz(), stats: { ...alcaraz().stats, lastResults: [1, 3] } },
        'stats.lastResults must only contain 1 (win) or 0 (loss)',
      ],
      [
        'a numeric string',
        { ...alcaraz(), stats: { ...alcaraz().stats, rank: '3' } },
        'stats.rank must be an integer number',
      ],
      [
        'an unknown nested field',
        { ...alcaraz(), country: { ...alcaraz().country, name: 'Spain' } },
        'country.property name should not exist',
      ],
    ])('rejects %s with a 400', async (_, body, detail) => {
      const response = await post(body).expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        path: '/api/v1/players',
      });
      expect(response.body.details).toContain(detail);
    });

    it('rejects a body that is not JSON with a 400', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/players')
        .set('x-api-key', TEST_API_KEY)
        .set('Content-Type', 'application/json')
        .send('{ not json')
        .expect(400);
    });

    it('rejects a body larger than 100 kB with a 413', async () => {
      const response = await post({ ...alcaraz(), firstName: 'x'.repeat(200_000) }).expect(413);

      expect(response.body).toMatchObject({
        statusCode: 413,
        error: 'Payload Too Large',
        path: '/api/v1/players',
      });
    });

    it('does not create anything on a validation error', async () => {
      await post({ ...alcaraz(), sex: 'X' }).expect(400);

      const { body } = await request(app.getHttpServer()).get('/api/v1/players').expect(200);
      expect(body).toHaveLength(5);
    });
  });

  describe('without a valid API key', () => {
    it.each([
      ['no key', null],
      ['a wrong key', 'definitely-not-the-right-key'],
    ])('returns a 401 with %s', async (_, apiKey) => {
      const { body } = await post(alcaraz(), apiKey).expect(401);

      expect(body).toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or invalid API key',
      });
    });

    it('checks the key before validating the body', async () => {
      await post({}, null).expect(401);
    });

    it('does not create anything', async () => {
      await post(alcaraz(), null).expect(401);

      await request(app.getHttpServer()).get('/api/v1/players/103').expect(404);
    });
  });
});
