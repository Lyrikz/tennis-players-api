import type { AppConfig } from '../../config/app.config';
import { createDynamoDbDocumentClient } from '../../database/dynamodb.client';
import type { PlayerRepository } from '../domain';
import { DynamoDbPlayerRepository } from './dynamodb/dynamodb-player.repository';
import { InMemoryPlayerRepository } from './in-memory-player.repository';

/**
 * DynamoDB when a table is configured (AWS deployments, DynamoDB Local),
 * bundled JSON otherwise (local development without AWS, e2e tests).
 */
export function createPlayerRepository(
  config: Pick<AppConfig, 'playersTableName' | 'dynamoDbEndpoint'>,
): PlayerRepository {
  if (config.playersTableName) {
    return new DynamoDbPlayerRepository(
      createDynamoDbDocumentClient({ endpoint: config.dynamoDbEndpoint }),
      config.playersTableName,
    );
  }
  return new InMemoryPlayerRepository();
}
