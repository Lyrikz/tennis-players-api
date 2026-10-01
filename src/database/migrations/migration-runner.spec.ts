import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Migration } from './migration';
import { MigrationRunner } from './migration-runner';
import { aMockedDocumentClient } from '../testing/mock-document-client';

const TABLE = 'table';
const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('MigrationRunner', () => {
  const { mock: dynamo, client } = aMockedDocumentClient();
  const log = jest.fn();
  const context = { client, tableName: TABLE, log };
  const executed: string[] = [];

  const aMigration = (
    id: string,
    up: () => Promise<void> = () => Promise.resolve(),
  ): Migration => ({
    id,
    description: `Migration ${id}`,
    up: jest.fn(async () => {
      await up();
      executed.push(id);
    }),
  });

  const recordedIds = () =>
    dynamo.commandCalls(PutCommand).map((call) => call.args[0].input.Item?.SK as string);

  beforeEach(() => {
    dynamo.reset();
    dynamo.on(PutCommand).resolves({});
    log.mockClear();
    executed.length = 0;
  });

  it('applies pending migrations in order and records them', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });
    const migrations = [aMigration('001-first'), aMigration('002-second')];

    const applied = await new MigrationRunner(context, migrations, () => NOW).run();

    expect(applied).toEqual(['001-first', '002-second']);
    expect(executed).toEqual(['001-first', '002-second']);
    expect(dynamo.commandCalls(PutCommand)[0]!.args[0].input).toEqual({
      TableName: TABLE,
      Item: {
        PK: 'MIGRATIONS',
        SK: '001-first',
        entityType: 'Migration',
        description: 'Migration 001-first',
        appliedAt: '2026-01-01T00:00:00.000Z',
      },
      ConditionExpression: 'attribute_not_exists(#pk)',
      ExpressionAttributeNames: { '#pk': 'PK' },
    });
  });

  it('reads applied migrations from the MIGRATIONS partition', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [] });

    await new MigrationRunner(context, []).run();

    expect(dynamo.commandCalls(QueryCommand)[0]!.args[0].input).toMatchObject({
      TableName: TABLE,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeValues: { ':pk': 'MIGRATIONS' },
    });
  });

  it('skips migrations that were already applied', async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ SK: '001-first' }], LastEvaluatedKey: { PK: 'MIGRATIONS' } })
      .resolvesOnce({ Items: [{ SK: '002-second' }] });

    const applied = await new MigrationRunner(context, [
      aMigration('001-first'),
      aMigration('002-second'),
      aMigration('003-third'),
    ]).run();

    expect(applied).toEqual(['003-third']);
    expect(executed).toEqual(['003-third']);
    expect(recordedIds()).toEqual(['003-third']);
  });

  it('is a no-op when the database is up to date', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [{ SK: '001-first' }] });

    await expect(new MigrationRunner(context, [aMigration('001-first')]).run()).resolves.toEqual(
      [],
    );
    expect(recordedIds()).toEqual([]);
  });

  it('stops at the first failure without recording it', async () => {
    dynamo.on(QueryCommand).resolves({});
    const failing = aMigration('002-failing', () => Promise.reject(new Error('boom')));

    await expect(
      new MigrationRunner(context, [
        aMigration('001-first'),
        failing,
        aMigration('003-third'),
      ]).run(),
    ).rejects.toThrow('boom');
    expect(recordedIds()).toEqual(['001-first']);
    expect(executed).toEqual(['001-first']);
  });

  it('uses the current date by default', async () => {
    jest.useFakeTimers({ now: NOW });
    dynamo.on(QueryCommand).resolves({});

    await new MigrationRunner(context, [aMigration('001-first')]).run();
    jest.useRealTimers();

    expect(dynamo.commandCalls(PutCommand)[0]!.args[0].input.Item?.appliedAt).toBe(
      NOW.toISOString(),
    );
  });

  it.each([
    [['1-bad'], 'Invalid migration id "1-bad"'],
    [['001-Bad_Name'], 'Invalid migration id "001-Bad_Name"'],
    [['002-second', '001-first'], 'Migrations must be sorted by unique id'],
    [['001-first', '001-first'], 'Migrations must be sorted by unique id'],
  ])('rejects ill-formed migration lists %p', (ids, message) => {
    expect(
      () =>
        new MigrationRunner(
          context,
          ids.map((id) => aMigration(id)),
        ),
    ).toThrow(message);
  });
});
