import {
  CreateTableCommand,
  type CreateTableCommandInput,
  DescribeTableCommand,
  type DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { TableSchema } from './table-schema';

const { partitionKey, sortKey, indexes } = TableSchema;

/**
 * Table definition for DynamoDB Local (scripts and integration tests).
 * In AWS, the table is owned by the CDK stack, built from the same `TableSchema`.
 */
export function localTableDefinition(tableName: string): CreateTableCommandInput {
  const indexDefinitions = Object.values(indexes);
  const keyAttributes = [
    partitionKey,
    sortKey,
    ...indexDefinitions.flatMap((index) => [index.partitionKey, index.sortKey]),
  ];

  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: keyAttributes.map((AttributeName) => ({
      AttributeName,
      AttributeType: 'S',
    })),
    KeySchema: [
      { AttributeName: partitionKey, KeyType: 'HASH' },
      { AttributeName: sortKey, KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: indexDefinitions.map((index) => ({
      IndexName: index.name,
      KeySchema: [
        { AttributeName: index.partitionKey, KeyType: 'HASH' },
        { AttributeName: index.sortKey, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    })),
  };
}

/** Creates the table unless it already exists. Intended for DynamoDB Local only. */
export async function ensureLocalTable(
  client: DynamoDBClient,
  tableName: string,
): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return false;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) {
      throw error;
    }
  }
  await client.send(new CreateTableCommand(localTableDefinition(tableName)));
  await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: tableName });
  return true;
}
