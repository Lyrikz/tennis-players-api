import { MatchResult, Sex } from '../domain';
import { aPlayer } from '../testing/player.fixture';
import { PlayerMapper } from './player.mapper';

describe('PlayerMapper', () => {
  it('maps an empty query to empty criteria', () => {
    expect(PlayerMapper.toCriteria({})).toEqual({ sex: undefined, countryCode: undefined });
  });

  it('maps a player to its response DTO', () => {
    const player = aPlayer({
      id: 52,
      sex: Sex.Male,
      rank: 2,
      points: 2542,
      weightKg: 80,
      heightCm: 188,
      age: 31,
      lastResults: [MatchResult.Win, MatchResult.Loss],
    });

    expect(PlayerMapper.toResponse(player)).toEqual({
      id: 52,
      firstName: player.firstName,
      lastName: player.lastName,
      shortName: player.shortName,
      sex: 'M',
      country: player.country,
      pictureUrl: player.pictureUrl,
      stats: { rank: 2, points: 2542, weightKg: 80, heightCm: 188, age: 31, lastResults: [1, 0] },
    });
  });

  it('keeps null statistics', () => {
    expect(
      PlayerMapper.toStatsResponse({ bestCountry: null, averageBmi: null, medianHeightCm: null }),
    ).toEqual({ bestCountry: null, averageBmi: null, medianHeightCm: null });
  });
});
