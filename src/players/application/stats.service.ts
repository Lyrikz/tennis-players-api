import type { PlayerRepository } from '../domain';
import { median, round } from './statistics/math';
import {
  averageBodyMassIndex,
  bestCountryByWinRatio,
  type CountryWinRatio,
} from './statistics/player-statistics';

const DECIMALS = 2;

export interface PlayersStatistics {
  /** `null` when no match has been recorded. */
  readonly bestCountry: CountryWinRatio | null;
  /** Rounded to 2 decimals; `null` when there is no player. */
  readonly averageBmi: number | null;
  /** In centimetres; `null` when there is no player. */
  readonly medianHeightCm: number | null;
}

const roundOrNull = (value: number | null): number | null =>
  value === null ? null : round(value, DECIMALS);

export class StatsService {
  constructor(private readonly repository: PlayerRepository) {}

  async getStatistics(): Promise<PlayersStatistics> {
    const players = await this.repository.findAll();
    const bestCountry = bestCountryByWinRatio(players);

    return {
      bestCountry: bestCountry && {
        ...bestCountry,
        winRatio: round(bestCountry.winRatio, DECIMALS),
      },
      averageBmi: roundOrNull(averageBodyMassIndex(players)),
      medianHeightCm: median(players.map((player) => player.heightCm)),
    };
  }
}
