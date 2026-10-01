import { paginateQuery, PutCommand } from '@aws-sdk/lib-dynamodb';
import { TableSchema } from '../table-schema';
import type { Migration, MigrationContext } from './migration';

export const MIGRATION_ENTITY = 'Migration';
/** All applied migrations live in a single partition of the table. */
export const MIGRATIONS_PARTITION = 'MIGRATIONS';

const MIGRATION_ID = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const { partitionKey, sortKey, entityType } = TableSchema;

/**
 * Applies pending migrations in order and records each one in the table itself
 * (`PK = MIGRATIONS`, `SK = <id>`), as a second entity of the single-table design.
 */
export class MigrationRunner {
  constructor(
    private readonly context: MigrationContext,
    private readonly migrations: readonly Migration[],
    private readonly now: () => Date = () => new Date(),
  ) {
    assertWellFormed(migrations);
  }

  /** @returns the ids of the migrations applied by this run. */
  async run(): Promise<string[]> {
    const { log, tableName } = this.context;
    const applied = await this.appliedIds();
    const pending = this.migrations.filter((migration) => !applied.has(migration.id));

    log('Database migrations', {
      tableName,
      applied: [...applied],
      pending: pending.map(({ id }) => id),
    });

    for (const migration of pending) {
      log(`Applying migration ${migration.id}`, { description: migration.description });
      await migration.up(this.context);
      await this.markAsApplied(migration);
    }
    return pending.map(({ id }) => id);
  }

  private async appliedIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    const pages = paginateQuery(
      { client: this.context.client },
      {
        TableName: this.context.tableName,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': partitionKey, '#sk': sortKey },
        ExpressionAttributeValues: { ':pk': MIGRATIONS_PARTITION },
        ProjectionExpression: '#sk',
      },
    );
    for await (const page of pages) {
      for (const item of page.Items ?? []) {
        ids.add(String(item[sortKey]));
      }
    }
    return ids;
  }

  private async markAsApplied(migration: Migration): Promise<void> {
    await this.context.client.send(
      new PutCommand({
        TableName: this.context.tableName,
        Item: {
          [partitionKey]: MIGRATIONS_PARTITION,
          [sortKey]: migration.id,
          [entityType]: MIGRATION_ENTITY,
          description: migration.description,
          appliedAt: this.now().toISOString(),
        },
        // Fails loudly if a concurrent run already recorded it.
        ConditionExpression: 'attribute_not_exists(#pk)',
        ExpressionAttributeNames: { '#pk': partitionKey },
      }),
    );
  }
}

function assertWellFormed(migrations: readonly Migration[]): void {
  migrations.forEach(({ id }, index) => {
    if (!MIGRATION_ID.test(id)) {
      throw new Error(`Invalid migration id "${id}": expected "NNN-kebab-case-name"`);
    }
    const previous = migrations[index - 1];
    if (previous && previous.id >= id) {
      throw new Error(`Migrations must be sorted by unique id: "${previous.id}" ≥ "${id}"`);
    }
  });
}
