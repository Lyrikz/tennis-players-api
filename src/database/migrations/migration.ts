import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Log } from '../log';

export interface MigrationContext {
  readonly client: DynamoDBDocumentClient;
  readonly tableName: string;
  readonly log: Log;
}

/**
 * A versioned, forward-only data migration.
 *
 * - `id` is `NNN-kebab-case-name`; migrations run in `id` order, once per table.
 * - `up` must be idempotent: if it fails halfway, it is not recorded and will
 *   run again in full on the next deployment.
 * - An applied migration is never modified: write a new one instead.
 */
export interface Migration {
  readonly id: string;
  readonly description: string;
  up(context: MigrationContext): Promise<void>;
}
