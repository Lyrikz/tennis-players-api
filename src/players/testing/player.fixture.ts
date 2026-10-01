import { MatchResult, type Player, Sex } from '../domain';

const { Win: W, Loss: L } = MatchResult;

/** Builds a valid player; override only what the test cares about. */
export function aPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    shortName: 'J.DOE',
    sex: Sex.Male,
    country: { code: 'FRA', pictureUrl: 'https://example.com/fra.png' },
    pictureUrl: 'https://example.com/doe.png',
    rank: 1,
    points: 1000,
    weightKg: 80,
    heightCm: 180,
    age: 30,
    lastResults: [W, L, W, L, W],
    ...overrides,
  };
}

export function fromCountry(code: string): Pick<Player, 'country'> {
  return { country: { code, pictureUrl: `https://example.com/${code}.png` } };
}

export { W, L };
