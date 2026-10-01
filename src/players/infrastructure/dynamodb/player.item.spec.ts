import { MatchResult, Sex } from '../../domain';
import { aPlayer } from '../../testing/player.fixture';
import { fromPlayerItem, PlayerKeys, toPlayerItem } from './player.item';

describe('player item', () => {
  const player = aPlayer({
    id: 52,
    sex: Sex.Male,
    country: { code: 'SRB', pictureUrl: 'https://example.com/srb.png' },
    rank: 2,
    lastResults: [MatchResult.Win, MatchResult.Loss],
  });

  it('stores a player with the single-table keys of the Player entity', () => {
    expect(toPlayerItem(player)).toMatchObject({
      PK: 'PLAYER#52',
      SK: 'PROFILE',
      GSI1PK: 'PLAYERS',
      GSI1SK: 'RANK#00002',
      GSI2PK: 'COUNTRY#SRB',
      GSI2SK: 'RANK#00002',
      entityType: 'Player',
      countryCode: 'SRB',
      countryPictureUrl: 'https://example.com/srb.png',
      lastResults: [1, 0],
    });
  });

  it('round-trips without loss', () => {
    expect(fromPlayerItem(toPlayerItem(player))).toEqual(player);
  });

  describe('rank key', () => {
    it('is zero-padded so that lexicographic order matches numeric order', () => {
      const keys = [10, 2, 100, 1].map(PlayerKeys.rank).sort();

      expect(keys).toEqual(['RANK#00001', 'RANK#00002', 'RANK#00010', 'RANK#00100']);
    });

    it.each([0, -1, 1.5, 100_000])('rejects %p', (rank) => {
      expect(() => PlayerKeys.rank(rank)).toThrow(RangeError);
    });
  });
});
