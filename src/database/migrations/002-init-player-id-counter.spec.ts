import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { aMockedDocumentClient } from '../testing/mock-document-client';
import { initPlayerIdCounter } from './002-init-player-id-counter';
import { MIGRATIONS } from './index';

describe('002-init-player-id-counter', () => {
  const { mock: dynamo, client } = aMockedDocumentClient();
  const log = jest.fn();
  const run = () => initPlayerIdCounter.up({ client, tableName: 'table', log });

  beforeEach(() => {
    dynamo.reset();
    log.mockClear();
  });

  it('sets the counter to the highest player id, across pages', async () => {
    dynamo
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ id: 17 }, { id: 102 }], LastEvaluatedKey: { PK: 'x' } })
      .resolvesOnce({ Items: [{ id: 95 }] });
    dynamo.on(UpdateCommand).resolves({});

    await run();

    expect(dynamo.commandCalls(QueryCommand)[0]!.args[0].input).toMatchObject({
      IndexName: 'GSI1',
      ExpressionAttributeValues: { ':pk': 'PLAYERS' },
      ProjectionExpression: '#id',
    });
    expect(dynamo.commandCalls(UpdateCommand)[0]!.args[0].input).toEqual({
      TableName: 'table',
      Key: { PK: 'COUNTER', SK: 'PLAYER' },
      UpdateExpression: 'SET #value = :highest',
      ConditionExpression: 'attribute_not_exists(#value) OR #value < :highest',
      ExpressionAttributeNames: { '#value': 'currentValue' },
      ExpressionAttributeValues: { ':highest': 102 },
    });
    expect(log).toHaveBeenCalledWith('Player id counter set to 102');
  });

  it('starts from 0 on an empty table', async () => {
    dynamo.on(QueryCommand).resolves({});
    dynamo.on(UpdateCommand).resolves({});

    await run();

    expect(dynamo.commandCalls(UpdateCommand)[0]!.args[0].input.ExpressionAttributeValues).toEqual({
      ':highest': 0,
    });
  });

  it('never moves the counter backwards', async () => {
    dynamo.on(QueryCommand).resolves({ Items: [{ id: 17 }] });
    dynamo
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'condition', $metadata: {} }));

    await expect(run()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('Player id counter already at or above 17');
  });

  it('propagates unexpected errors', async () => {
    dynamo.on(QueryCommand).resolves({});
    dynamo.on(UpdateCommand).rejects(new Error('throttled'));

    await expect(run()).rejects.toThrow('throttled');
  });

  it('runs after the seed', () => {
    expect(MIGRATIONS.map(({ id }) => id)).toEqual([
      '001-seed-players',
      '002-init-player-id-counter',
    ]);
  });
});
