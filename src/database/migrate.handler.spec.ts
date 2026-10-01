import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from './migrate.handler';

const event = (RequestType: 'Create' | 'Update' | 'Delete') =>
  ({ RequestType }) as CloudFormationCustomResourceEvent;

describe('migrate handler', () => {
  const dynamo = mockClient(DynamoDBDocumentClient);
  const originalTable = process.env.PLAYERS_TABLE_NAME;

  beforeEach(() => {
    dynamo.reset();
    dynamo.on(QueryCommand).resolves({ Items: [] });
    dynamo.on(BatchWriteCommand).resolves({});
    dynamo.on(PutCommand).resolves({});
    dynamo.on(UpdateCommand).resolves({});
    process.env.PLAYERS_TABLE_NAME = 'table';
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.env.PLAYERS_TABLE_NAME = originalTable;
    jest.restoreAllMocks();
  });

  it.each(['Create', 'Update'] as const)('applies pending migrations on %s', async (type) => {
    await expect(handler(event(type))).resolves.toEqual({
      PhysicalResourceId: 'database-migrations',
      Data: { applied: '001-seed-players,002-init-player-id-counter' },
    });
    expect(dynamo.commandCalls(PutCommand)).toHaveLength(2);
  });

  it('does nothing on Delete: the table is deleted with the stack', async () => {
    await expect(handler(event('Delete'))).resolves.toEqual({
      PhysicalResourceId: 'database-migrations',
    });
    expect(dynamo.calls()).toHaveLength(0);
  });

  it('fails when the table name is not configured', async () => {
    delete process.env.PLAYERS_TABLE_NAME;

    await expect(handler(event('Create'))).rejects.toThrow('PLAYERS_TABLE_NAME is not set');
  });
});
