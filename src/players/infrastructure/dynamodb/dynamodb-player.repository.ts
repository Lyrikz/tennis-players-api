import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  type DynamoDBDocumentClient,
  GetCommand,
  paginateQuery,
  PutCommand,
  type QueryCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { TableSchema } from '../../../database/table-schema';
import type { NewPlayer, Player, PlayerCriteria, PlayerRepository } from '../../domain';
import { fromPlayerItem, PlayerIdCounter, PlayerKeys, toPlayerItem } from './player.item';

const { partitionKey, sortKey, indexes } = TableSchema;

/**
 * Single-table DynamoDB implementation of the player repository.
 *
 * Every read is a `GetItem` or a `Query` on an index: no `Scan`, so the cost of
 * a request does not grow with the other entities stored in the table.
 */
export class DynamoDbPlayerRepository implements PlayerRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findAll(criteria: PlayerCriteria = {}): Promise<Player[]> {
    const players: Player[] = [];
    for await (const page of paginateQuery({ client: this.client }, this.buildQuery(criteria))) {
      players.push(...(page.Items ?? []).map(fromPlayerItem));
    }
    return players;
  }

  async findById(id: number): Promise<Player | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { [partitionKey]: PlayerKeys.partitionKey(id), [sortKey]: PlayerKeys.sortKey },
        // A player created a few milliseconds ago must be readable at its Location.
        ConsistentRead: true,
      }),
    );
    return Item && fromPlayerItem(Item);
  }

  async create(newPlayer: NewPlayer): Promise<Player> {
    const player: Player = { ...newPlayer, id: await this.nextId() };
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: toPlayerItem(player),
          // Safety net: never overwrite an existing player.
          ConditionExpression: 'attribute_not_exists(#pk)',
          ExpressionAttributeNames: { '#pk': partitionKey },
        }),
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        throw new Error(
          `Generated player id ${player.id} is already taken: is the id counter initialised?`,
          { cause: error },
        );
      }
      throw error;
    }
    return player;
  }

  private async nextId(): Promise<number> {
    const { Attributes } = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: PlayerIdCounter.key,
        UpdateExpression: 'ADD #value :one',
        ExpressionAttributeNames: { '#value': PlayerIdCounter.attribute },
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return Number(Attributes?.[PlayerIdCounter.attribute]);
  }

  /** Country → GSI2 partition, otherwise GSI1 (all players); sex is a filter. */
  private buildQuery({ sex, countryCode }: PlayerCriteria): QueryCommandInput {
    const index = countryCode === undefined ? indexes.byRank : indexes.byCountry;
    const indexPartition =
      countryCode === undefined ? PlayerKeys.allPlayers : PlayerKeys.country(countryCode);

    return {
      TableName: this.tableName,
      IndexName: index.name,
      KeyConditionExpression: '#pk = :pk',
      ExpressionAttributeNames: {
        '#pk': index.partitionKey,
        ...(sex !== undefined && { '#sex': 'sex' }),
      },
      ExpressionAttributeValues: {
        ':pk': indexPartition,
        ...(sex !== undefined && { ':sex': sex }),
      },
      ...(sex !== undefined && { FilterExpression: '#sex = :sex' }),
    };
  }
}
