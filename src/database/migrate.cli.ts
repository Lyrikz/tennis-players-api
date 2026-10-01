import { loadConfig } from '../config/app.config';
import { loadEnvFile } from '../config/env-file';
import { createDynamoDbDocumentClient } from './dynamodb.client';
import { ensureLocalTable } from './local-table';
import { jsonLog } from './log';
import { MIGRATIONS, MigrationRunner } from './migrations';

/**
 * `npm run db:migrate`: applies pending migrations to `PLAYERS_TABLE_NAME`.
 * Against DynamoDB Local (`DYNAMODB_ENDPOINT`), the table is created if needed.
 */
async function main(): Promise<void> {
  loadEnvFile();
  const { playersTableName: tableName, dynamoDbEndpoint: endpoint } = loadConfig();
  if (!tableName) {
    throw new Error('PLAYERS_TABLE_NAME is required');
  }

  const client = createDynamoDbDocumentClient({ endpoint });
  if (endpoint && (await ensureLocalTable(client, tableName))) {
    jsonLog(`Created table ${tableName}`, { endpoint });
  }

  const applied = await new MigrationRunner({ client, tableName, log: jsonLog }, MIGRATIONS).run();
  jsonLog(applied.length ? `Applied ${applied.join(', ')}` : 'Database is up to date');
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
