import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { createDynamoDbDocumentClient } from './dynamodb.client';
import { jsonLog } from './log';
import { MIGRATIONS, MigrationRunner } from './migrations';

/** Response expected by the CDK custom resource provider framework. */
export interface MigrationResponse {
  readonly PhysicalResourceId: string;
  readonly Data?: Record<string, string>;
}

const PHYSICAL_RESOURCE_ID = 'database-migrations';

/**
 * `onEvent` handler of the `Custom::DatabaseMigrations` resource: applies pending
 * migrations on every stack creation or update. Deleting the stack deletes the
 * table, so there is nothing to roll back.
 */
export async function handler(
  event: CloudFormationCustomResourceEvent,
): Promise<MigrationResponse> {
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: PHYSICAL_RESOURCE_ID };
  }

  const tableName = process.env.PLAYERS_TABLE_NAME;
  if (!tableName) {
    throw new Error('PLAYERS_TABLE_NAME is not set');
  }

  const applied = await new MigrationRunner(
    { client: createDynamoDbDocumentClient(), tableName, log: jsonLog },
    MIGRATIONS,
  ).run();

  return { PhysicalResourceId: PHYSICAL_RESOURCE_ID, Data: { applied: applied.join(',') } };
}
