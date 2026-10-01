import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { paginateQuery, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PlayerIdCounter, PlayerKeys } from '../../players/infrastructure/dynamodb/player.item';
import { TableSchema } from '../table-schema';
import type { Migration, MigrationContext } from './migration';

const { byRank } = TableSchema.indexes;

/**
 * Starts the player id counter after the highest existing id, so that players
 * created through the API never collide with the imported ones.
 * The counter can only move forward: running it again is harmless.
 */
export const initPlayerIdCounter: Migration = {
  id: '002-init-player-id-counter',
  description: 'Initialise the player id counter after the highest existing id',
  async up(context) {
    const highestId = await findHighestPlayerId(context);
    try {
      await context.client.send(
        new UpdateCommand({
          TableName: context.tableName,
          Key: PlayerIdCounter.key,
          UpdateExpression: 'SET #value = :highest',
          ConditionExpression: 'attribute_not_exists(#value) OR #value < :highest',
          ExpressionAttributeNames: { '#value': PlayerIdCounter.attribute },
          ExpressionAttributeValues: { ':highest': highestId },
        }),
      );
      context.log(`Player id counter set to ${highestId}`);
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }
      context.log(`Player id counter already at or above ${highestId}`);
    }
  },
};

async function findHighestPlayerId({ client, tableName }: MigrationContext): Promise<number> {
  let highest = 0;
  const pages = paginateQuery(
    { client },
    {
      TableName: tableName,
      IndexName: byRank.name,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: { '#pk': byRank.partitionKey, '#id': 'id' },
      ExpressionAttributeValues: { ':pk': PlayerKeys.allPlayers },
      ProjectionExpression: '#id',
    },
  );
  for await (const page of pages) {
    for (const item of page.Items ?? []) {
      highest = Math.max(highest, Number(item.id));
    }
  }
  return highest;
}
