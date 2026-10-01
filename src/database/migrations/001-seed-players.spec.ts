import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { seedPlayers } from './001-seed-players';
import { MIGRATIONS } from './index';
import { aMockedDocumentClient } from '../testing/mock-document-client';

describe('001-seed-players', () => {
  const { mock: dynamo, client } = aMockedDocumentClient();

  it('imports the bundled dataset, converted to the domain units', async () => {
    dynamo.on(BatchWriteCommand).resolves({});
    const log = jest.fn();

    await seedPlayers.up({
      client,
      tableName: 'table',
      log,
    });

    const requests = dynamo.commandCalls(BatchWriteCommand)[0]!.args[0].input.RequestItems!.table!;
    const items = requests.map((request) => request.PutRequest!.Item!);
    expect(items.map((item) => item.PK as string)).toEqual([
      'PLAYER#52',
      'PLAYER#95',
      'PLAYER#65',
      'PLAYER#102',
      'PLAYER#17',
    ]);
    expect(items[0]).toMatchObject({ lastName: 'Djokovic', weightKg: 80, GSI2PK: 'COUNTRY#SRB' });
    expect(log).toHaveBeenCalledWith('Imported 5 players');
  });

  it('is registered as the first migration', () => {
    expect(MIGRATIONS[0]).toBe(seedPlayers);
  });
});
