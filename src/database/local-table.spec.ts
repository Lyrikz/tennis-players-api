import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { ensureLocalTable, localTableDefinition } from './local-table';

describe('local table', () => {
  it('mirrors the single-table schema', () => {
    expect(localTableDefinition('players')).toEqual({
      TableName: 'players',
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: ['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK'].map(
        (AttributeName) => ({ AttributeName, AttributeType: 'S' }),
      ),
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        expect.objectContaining({
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        }),
        expect.objectContaining({ IndexName: 'GSI2' }),
      ],
    });
  });

  describe('ensureLocalTable', () => {
    const dynamo = mockClient(DynamoDBClient);
    const client = dynamo as unknown as DynamoDBClient;

    beforeEach(() => dynamo.reset());

    it('keeps an existing table', async () => {
      dynamo.on(DescribeTableCommand).resolves({ Table: { TableStatus: 'ACTIVE' } });

      await expect(ensureLocalTable(client, 'players')).resolves.toBe(false);
      expect(dynamo.commandCalls(CreateTableCommand)).toHaveLength(0);
    });

    it('creates a missing table and waits until it is active', async () => {
      dynamo
        .on(DescribeTableCommand)
        .rejectsOnce(new ResourceNotFoundException({ message: 'not found', $metadata: {} }))
        .resolves({ Table: { TableStatus: 'ACTIVE' } });
      dynamo.on(CreateTableCommand).resolves({});

      await expect(ensureLocalTable(client, 'players')).resolves.toBe(true);
      expect(dynamo.commandCalls(CreateTableCommand)[0]!.args[0].input.TableName).toBe('players');
    });

    it('propagates unexpected errors', async () => {
      dynamo.on(DescribeTableCommand).rejects(new Error('connection refused'));

      await expect(ensureLocalTable(client, 'players')).rejects.toThrow('connection refused');
    });
  });
});
