import { MatchResult, type Player } from '../../domain';
import { mean } from './math';

const CENTIMETRES_PER_METRE = 100;

/** Body Mass Index: weight (kg) / height (m)². */
export function bodyMassIndex(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) {
    throw new RangeError('Weight and height must be strictly positive to compute a BMI');
  }
  const heightM = heightCm / CENTIMETRES_PER_METRE;
  return weightKg / (heightM * heightM);
}

/** Mean of the players' individual BMIs (not the BMI of the mean weight and height). */
export function averageBodyMassIndex(players: readonly Player[]): number | null {
  return mean(players.map((player) => bodyMassIndex(player.weightKg, player.heightCm)));
}

export interface CountryWinRatio {
  readonly countryCode: string;
  readonly wins: number;
  readonly matches: number;
  /** wins / matches, between 0 and 1. */
  readonly winRatio: number;
}

/**
 * Country whose players have the best aggregated win ratio over their last matches.
 *
 * Matches are pooled per country (Σ wins / Σ matches) rather than averaging each
 * player's ratio, so every match weighs the same. Ties are broken by the number
 * of matches played (larger sample first), then by country code for determinism.
 * Countries without any recorded match are ignored.
 */
export function bestCountryByWinRatio(players: readonly Player[]): CountryWinRatio | null {
  const totals = new Map<string, { wins: number; matches: number }>();

  for (const player of players) {
    const total = totals.get(player.country.code) ?? { wins: 0, matches: 0 };
    total.wins += player.lastResults.filter((result) => result === MatchResult.Win).length;
    total.matches += player.lastResults.length;
    totals.set(player.country.code, total);
  }

  const ranking = [...totals.entries()]
    .filter(([, { matches }]) => matches > 0)
    .map(([countryCode, { wins, matches }]) => ({
      countryCode,
      wins,
      matches,
      winRatio: wins / matches,
    }))
    .sort(
      (a, b) =>
        b.winRatio - a.winRatio ||
        b.matches - a.matches ||
        a.countryCode.localeCompare(b.countryCode),
    );

  return ranking[0] ?? null;
}
