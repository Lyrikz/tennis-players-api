import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Sex } from '../../domain';
import { aPlayer, fromCountry } from '../../testing/player.fixture';
import { DynamoDbPlayerRepository } from './dynamodb-player.repository';
import { toPlayerItem } from './player.item';
import { aMockedDocumentClient } from '../../../database/testing/mock-document-client';

const TABLE = 'players-table';

describe('DynamoDbPlayerRepository', () => {
  const { mock: dynamo, client } = aMockedDocumentClient();
  const repository = new DynamoDbPlayerRepository(client, TABLE);

  const nadal = aPlayer({ id: 17, rank: 1, ...fromCountry('ESP') });
  const djokovic = aPlayer({ id: 52, rank: 2, ...fromCountry('SRB') });

  beforeEach(() => {
    dynamo.reset();
  });

  const lastQuery = () => dynamo.commandCalls(QueryCommand)[0]!.args[0].input;

  describe('findAll', () => {
    it('queries the by-rank index for all players', async () => {
      dynamo.on(QueryCommand).resolves({ Items: [toPlayerItem(nadal), toPlayerItem(djokovic)] });

      await expect(repository.findAll()).resolves.toEqual([nadal, djokovic]);
      expect(lastQuery()).toEqual({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'GSI1PK' },
        ExpressionAttributeValues: { ':pk': 'PLAYERS' },
      });
    });

    it('queries the by-country index when filtering by country', async () => {
      dynamo.on(QueryCommand).resolves({ Items: [toPlayerItem(djokovic)] });

      await expect(repository.findAll({ countryCode: 'SRB' })).resolves.toEqual([djokovic]);
      expect(lastQuery()).toMatchObject({
        IndexName: 'GSI2',
        ExpressionAttributeNames: { '#pk': 'GSI2PK' },
        ExpressionAttributeValues: { ':pk': 'COUNTRY#SRB' },
      });
      expect(lastQuery().FilterExpression).toBeUndefined();
    });

    it('filters by sex on top of the key condition', async () => {
      dynamo.on(QueryCommand).resolves({ Items: [] });

      await repository.findAll({ sex: Sex.Female, countryCode: 'USA' });

      expect(lastQuery()).toMatchObject({
        IndexName: 'GSI2',
        FilterExpression: '#sex = :sex',
        ExpressionAttributeNames: { '#pk': 'GSI2PK', '#sex': 'sex' },
        ExpressionAttributeValues: { ':pk': 'COUNTRY#USA', ':sex': 'F' },
      });
    });

    it('follows pagination until the last page', async () => {
      dynamo
        .on(QueryCommand)
        .resolvesOnce({ Items: [toPlayerItem(nadal)], LastEvaluatedKey: { PK: 'PLAYER#17' } })
        .resolvesOnce({ Items: [toPlayerItem(djokovic)] });

      await expect(repository.findAll()).resolves.toEqual([nadal, djokovic]);
      expect(dynamo.commandCalls(QueryCommand)[1]!.args[0].input.ExclusiveStartKey).toEqual({
        PK: 'PLAYER#17',
      });
    });

    it('returns an empty list when the query returns no items', async () => {
      dynamo.on(QueryCommand).resolves({});

      await expect(repository.findAll()).resolves.toEqual([]);
    });
  });

  describe('findById', () => {
    it('gets the player profile item', async () => {
      dynamo.on(GetCommand).resolves({ Item: toPlayerItem(djokovic) });

      await expect(repository.findById(52)).resolves.toEqual(djokovic);
      expect(dynamo.commandCalls(GetCommand)[0]!.args[0].input).toEqual({
        TableName: TABLE,
        Key: { PK: 'PLAYER#52', SK: 'PROFILE' },
        ConsistentRead: true,
      });
    });

    it('returns undefined when the item does not exist', async () => {
      dynamo.on(GetCommand).resolves({});

      await expect(repository.findById(999)).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    const { id: _id, ...newPlayer } = aPlayer({ rank: 3, ...fromCountry('ESP') });

    it('takes the next id from the atomic counter and writes the player item', async () => {
      dynamo.on(UpdateCommand).resolves({ Attributes: { currentValue: 103 } });
      dynamo.on(PutCommand).resolves({});

      await expect(repository.create(newPlayer)).resolves.toEqual({ ...newPlayer, id: 103 });

      expect(dynamo.commandCalls(UpdateCommand)[0]!.args[0].input).toEqual({
        TableName: TABLE,
        Key: { PK: 'COUNTER', SK: 'PLAYER' },
        UpdateExpression: 'ADD #value :one',
        ExpressionAttributeNames: { '#value': 'currentValue' },
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      });
      expect(dynamo.commandCalls(PutCommand)[0]!.args[0].input).toEqual({
        TableName: TABLE,
        Item: toPlayerItem({ ...newPlayer, id: 103 }),
        ConditionExpression: 'attribute_not_exists(#pk)',
        ExpressionAttributeNames: { '#pk': 'PK' },
      });
    });

    it('never overwrites an existing player', async () => {
      dynamo.on(UpdateCommand).resolves({ Attributes: { currentValue: 17 } });
      dynamo
        .on(PutCommand)
        .rejects(new ConditionalCheckFailedException({ message: 'exists', $metadata: {} }));

      await expect(repository.create(newPlayer)).rejects.toThrow(
        'Generated player id 17 is already taken: is the id counter initialised?',
      );
    });

    it('propagates other errors', async () => {
      dynamo.on(UpdateCommand).resolves({ Attributes: { currentValue: 103 } });
      dynamo.on(PutCommand).rejects(new Error('throttled'));

      await expect(repository.create(newPlayer)).rejects.toThrow('throttled');
    });
  });
});
