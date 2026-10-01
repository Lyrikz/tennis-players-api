import { aPlayer, fromCountry, L, W } from '../../testing/player.fixture';
import { averageBodyMassIndex, bestCountryByWinRatio, bodyMassIndex } from './player-statistics';

describe('player statistics', () => {
  describe('bodyMassIndex', () => {
    it('computes weight / height² with height converted to metres', () => {
      expect(bodyMassIndex(80, 200)).toBe(20);
      expect(bodyMassIndex(80, 188)).toBeCloseTo(22.635, 3);
    });

    it.each([
      [0, 180],
      [80, 0],
      [-1, 180],
    ])('rejects non-positive inputs (weight=%p, height=%p)', (weight, height) => {
      expect(() => bodyMassIndex(weight, height)).toThrow(RangeError);
    });
  });

  describe('averageBodyMassIndex', () => {
    it('returns null when there is no player', () => {
      expect(averageBodyMassIndex([])).toBeNull();
    });

    it('averages individual BMIs', () => {
      const players = [
        aPlayer({ weightKg: 80, heightCm: 200 }), // 20
        aPlayer({ weightKg: 90, heightCm: 200 }), // 22.5
      ];
      expect(averageBodyMassIndex(players)).toBe(21.25);
    });
  });

  describe('bestCountryByWinRatio', () => {
    it('returns null when there is no player', () => {
      expect(bestCountryByWinRatio([])).toBeNull();
    });

    it('returns null when no match has been played', () => {
      expect(bestCountryByWinRatio([aPlayer({ lastResults: [] })])).toBeNull();
    });

    it('pools the matches of all players from the same country', () => {
      const players = [
        aPlayer({ ...fromCountry('USA'), lastResults: [W, W, W, W, W] }),
        aPlayer({ ...fromCountry('USA'), lastResults: [L, L, L, L, L] }),
        aPlayer({ ...fromCountry('SUI'), lastResults: [W, W, W, L, L] }),
      ];

      expect(bestCountryByWinRatio(players)).toEqual({
        countryCode: 'SUI',
        wins: 3,
        matches: 5,
        winRatio: 0.6,
      });
    });

    it('weighs every match equally when players have played different numbers of matches', () => {
      const players = [
        aPlayer({ ...fromCountry('ESP'), lastResults: [W] }),
        aPlayer({ ...fromCountry('ESP'), lastResults: [L, L, L] }), // pooled: 1/4 = 0.25
        aPlayer({ ...fromCountry('ITA'), lastResults: [W, L, L] }), // 1/3 ≈ 0.33
      ];

      expect(bestCountryByWinRatio(players)?.countryCode).toBe('ITA');
    });

    it('breaks ties on ratio by the number of matches played', () => {
      const players = [
        aPlayer({ ...fromCountry('AAA'), lastResults: [W] }),
        aPlayer({ ...fromCountry('ZZZ'), lastResults: [W, W, W] }),
      ];

      expect(bestCountryByWinRatio(players)?.countryCode).toBe('ZZZ');
    });

    it('breaks remaining ties by country code', () => {
      const players = [
        aPlayer({ ...fromCountry('SRB'), lastResults: [W, L] }),
        aPlayer({ ...fromCountry('ARG'), lastResults: [L, W] }),
      ];

      expect(bestCountryByWinRatio(players)?.countryCode).toBe('ARG');
    });

    it('ignores countries without any match', () => {
      const players = [
        aPlayer({ ...fromCountry('AAA'), lastResults: [] }),
        aPlayer({ ...fromCountry('BBB'), lastResults: [L] }),
      ];

      expect(bestCountryByWinRatio(players)).toEqual({
        countryCode: 'BBB',
        wins: 0,
        matches: 1,
        winRatio: 0,
      });
    });
  });
});
