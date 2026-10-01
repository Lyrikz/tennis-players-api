import { DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDynamoDbDocumentClient } from '../../src/database/dynamodb.client';
import { ensureLocalTable } from '../../src/database/local-table';

export const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT;

/**
 * Integration tests need DynamoDB Local (`docker compose up -d dynamodb`).
 * Without `DYNAMODB_ENDPOINT` they are skipped, loudly; the CI always runs them.
 */
export const describeWithDynamoDb = DYNAMODB_ENDPOINT ? describe : describe.skip;

if (!DYNAMODB_ENDPOINT) {
  process.stderr.write(
    'DYNAMODB_ENDPOINT is not set: DynamoDB integration tests are skipped (see README).\n',
  );
}

export interface TestTable {
  readonly client: DynamoDBDocumentClient;
  readonly tableName: string;
  drop(): Promise<void>;
}

/** A fresh, uniquely named table per test suite: suites can run in parallel. */
export async function createTestTable(prefix: string): Promise<TestTable> {
  const tableName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const client = createDynamoDbDocumentClient({ endpoint: DYNAMODB_ENDPOINT });
  await ensureLocalTable(client, tableName);
  return {
    client,
    tableName,
    drop: async () => {
      await client.send(new DeleteTableCommand({ TableName: tableName }));
      client.destroy();
    },
  };
}
