import { MatchResult, Sex } from '../domain';
import type { RawPlayer } from './raw-player';
import { toPlayer } from './raw-player.mapper';

const raw: RawPlayer = {
  id: 52,
  firstname: 'Novak',
  lastname: 'Djokovic',
  shortname: 'N.DJO',
  sex: 'M',
  country: { picture: 'https://example.com/srb.png', code: 'SRB' },
  picture: 'https://example.com/djokovic.png',
  data: { rank: 2, points: 2542, weight: 80000, height: 188, age: 31, last: [1, 0, 1, 1, 1] },
};

describe('toPlayer', () => {
  it('maps the raw format to the domain model, converting grams to kilograms', () => {
    expect(toPlayer(raw)).toEqual({
      id: 52,
      firstName: 'Novak',
      lastName: 'Djokovic',
      shortName: 'N.DJO',
      sex: Sex.Male,
      country: { code: 'SRB', pictureUrl: 'https://example.com/srb.png' },
      pictureUrl: 'https://example.com/djokovic.png',
      rank: 2,
      points: 2542,
      weightKg: 80,
      heightCm: 188,
      age: 31,
      lastResults: [
        MatchResult.Win,
        MatchResult.Loss,
        MatchResult.Win,
        MatchResult.Win,
        MatchResult.Win,
      ],
    });
  });

  it('rejects an unknown sex', () => {
    expect(() => toPlayer({ ...raw, sex: 'X' })).toThrow('Invalid sex "X" for player 52');
  });

  it('rejects an unknown match result', () => {
    expect(() => toPlayer({ ...raw, data: { ...raw.data, last: [1, 2] } })).toThrow(
      'Invalid match result "2" for player 52',
    );
  });
});
