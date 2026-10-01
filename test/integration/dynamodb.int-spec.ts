import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { MIGRATIONS, MigrationRunner } from '../../src/database/migrations';
import { Sex } from '../../src/players/domain';
import { DynamoDbPlayerRepository } from '../../src/players/infrastructure/dynamodb/dynamodb-player.repository';
import { aPlayer } from '../../src/players/testing/player.fixture';
import { createTestApp } from '../app.factory';
import {
  createTestTable,
  describeWithDynamoDb,
  DYNAMODB_ENDPOINT,
  type TestTable,
} from './dynamodb-local';

const API_KEY = 'integration-test-api-key-0123';

const alcarazRequest = {
  firstName: 'Carlos',
  lastName: 'Alcaraz',
  shortName: 'C.ALC',
  sex: 'M',
  country: { code: 'ESP', pictureUrl: 'https://example.com/esp.png' },
  pictureUrl: 'https://example.com/alcaraz.png',
  stats: { rank: 3, points: 2000, weightKg: 74, heightCm: 183, age: 21, lastResults: [1, 1, 1] },
};

describeWithDynamoDb('DynamoDB single-table (integration)', () => {
  let table: TestTable;
  let repository: DynamoDbPlayerRepository;
  const log = jest.fn();

  beforeAll(async () => {
    table = await createTestTable('players-it');
    repository = new DynamoDbPlayerRepository(table.client, table.tableName);
  });

  afterAll(async () => {
    await table.drop();
  });

  describe('migrations', () => {
    const runner = () =>
      new MigrationRunner({ client: table.client, tableName: table.tableName, log }, MIGRATIONS);

    it('apply pending migrations on an empty table', async () => {
      await expect(runner().run()).resolves.toEqual([
        '001-seed-players',
        '002-init-player-id-counter',
      ]);
    });

    it('are not applied twice', async () => {
      await expect(runner().run()).resolves.toEqual([]);
    });
  });

  describe('repository', () => {
    const ids = (players: { id: number }[]) => players.map(({ id }) => id);

    it('lists all players in official rank order from the by-rank index', async () => {
      expect(ids(await repository.findAll())).toEqual([17, 52, 102, 65, 95]);
    });

    it('does not return migration items', async () => {
      const players = await repository.findAll();

      expect(players).toHaveLength(5);
    });

    it('filters by country through the by-country index', async () => {
      expect(ids(await repository.findAll({ countryCode: 'USA' }))).toEqual([102, 95]);
    });

    it('filters by sex', async () => {
      expect(ids(await repository.findAll({ sex: Sex.Male }))).toEqual([17, 52, 65]);
    });

    it('combines both filters', async () => {
      expect(ids(await repository.findAll({ sex: Sex.Female, countryCode: 'USA' }))).toEqual([
        102, 95,
      ]);
      await expect(repository.findAll({ sex: Sex.Male, countryCode: 'USA' })).resolves.toEqual([]);
    });

    it('finds a player by id, with domain units', async () => {
      await expect(repository.findById(52)).resolves.toMatchObject({
        lastName: 'Djokovic',
        weightKg: 80,
        heightCm: 188,
        country: { code: 'SRB' },
      });
    });

    it('returns undefined for an unknown id', async () => {
      await expect(repository.findById(999)).resolves.toBeUndefined();
    });
  });

  describe('API backed by DynamoDB', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
      process.env.PLAYERS_TABLE_NAME = table.tableName;
      process.env.DYNAMODB_ENDPOINT = DYNAMODB_ENDPOINT;
      process.env.API_KEY = API_KEY;
      app = await createTestApp();
    });

    afterAll(async () => {
      await app.close();
      delete process.env.PLAYERS_TABLE_NAME;
    });

    it('GET /api/v1/stats computes the same statistics as with the bundled dataset', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/stats')
        .expect(200, {
          bestCountry: { code: 'SRB', winRatio: 1, wins: 5, matches: 5 },
          averageBmi: 23.36,
          medianHeightCm: 185,
        });
    });

    it('GET /api/v1/players/:id returns 404 for an unknown player', async () => {
      await request(app.getHttpServer()).get('/api/v1/players/999').expect(404);
    });

    it('POST /api/v1/players persists the player, readable right away at its Location', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/players')
        .set('x-api-key', API_KEY)
        .send(alcarazRequest)
        .expect(201);

      expect(response.headers.location).toBe('/api/v1/players/103');
      await request(app.getHttpServer())
        .get('/api/v1/players/103')
        .expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ id: 103, lastName: 'Alcaraz' }));
    });
  });

  // Runs last: it adds players to the shared table.
  describe('player creation', () => {
    const { id: _id, ...newPlayer } = aPlayer({
      country: { code: 'ITA', pictureUrl: 'https://example.com/ita.png' },
      rank: 4,
    });

    it('continues the ids after the imported ones and indexes the player', async () => {
      const created = await repository.create(newPlayer);

      expect(created.id).toBeGreaterThan(102);
      await expect(repository.findById(created.id)).resolves.toEqual(created);
      expect((await repository.findAll({ countryCode: 'ITA' })).map(({ id }) => id)).toContain(
        created.id,
      );
    });

    it('hands out unique ids under concurrent creations', async () => {
      const created = await Promise.all(
        Array.from({ length: 20 }, () => repository.create(newPlayer)),
      );
      const ids = created.map(({ id }) => id);

      expect(new Set(ids).size).toBe(20);
    });
  });
});
