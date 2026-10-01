import { DynamoDbPlayerRepository } from './dynamodb/dynamodb-player.repository';
import { InMemoryPlayerRepository } from './in-memory-player.repository';
import { createPlayerRepository } from './player-repository.factory';

describe('createPlayerRepository', () => {
  it('uses DynamoDB when a table is configured', () => {
    expect(createPlayerRepository({ playersTableName: 'players' })).toBeInstanceOf(
      DynamoDbPlayerRepository,
    );
  });

  it('falls back to the bundled dataset otherwise', () => {
    expect(createPlayerRepository({})).toBeInstanceOf(InMemoryPlayerRepository);
  });
});
