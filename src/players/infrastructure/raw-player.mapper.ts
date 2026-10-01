import { MatchResult, type Player, Sex } from '../domain';
import type { RawPlayer } from './raw-player';

const GRAMS_PER_KILOGRAM = 1000;

const SEXES: ReadonlySet<string> = new Set(Object.values(Sex));

function toSex(value: string, playerId: number): Sex {
  if (!SEXES.has(value)) {
    throw new Error(`Invalid sex "${value}" for player ${playerId}`);
  }
  return value as Sex;
}

function toMatchResult(value: number, playerId: number): MatchResult {
  if (value !== Number(MatchResult.Win) && value !== Number(MatchResult.Loss)) {
    throw new Error(`Invalid match result "${value}" for player ${playerId}`);
  }
  return value;
}

/**
 * Converts the raw data source format into the domain model.
 * Fails fast on unexpected values rather than serving corrupted statistics.
 */
export function toPlayer(raw: RawPlayer): Player {
  return {
    id: raw.id,
    firstName: raw.firstname,
    lastName: raw.lastname,
    shortName: raw.shortname,
    sex: toSex(raw.sex, raw.id),
    country: { code: raw.country.code, pictureUrl: raw.country.picture },
    pictureUrl: raw.picture,
    rank: raw.data.rank,
    points: raw.data.points,
    weightKg: raw.data.weight / GRAMS_PER_KILOGRAM,
    heightCm: raw.data.height,
    age: raw.data.age,
    lastResults: raw.data.last.map((result) => toMatchResult(result, raw.id)),
  };
}
