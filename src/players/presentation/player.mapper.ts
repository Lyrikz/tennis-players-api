import type { NewPlayer, Player, PlayerCriteria } from '../domain';
import type { PlayersStatistics } from '../application/stats.service';
import type { CreatePlayerRequestDto } from './dto/create-player.request.dto';
import type { ListPlayersQueryDto } from './dto/list-players.query.dto';
import type { PlayerResponseDto } from './dto/player-response.dto';
import type { StatsResponseDto } from './dto/stats-response.dto';

/** Translations between the HTTP contract and the domain model. */
export const PlayerMapper = {
  toCriteria(query: ListPlayersQueryDto): PlayerCriteria {
    return { sex: query.sex, countryCode: query.country };
  },

  toNewPlayer(request: CreatePlayerRequestDto): NewPlayer {
    const { country, stats } = request;
    return {
      firstName: request.firstName,
      lastName: request.lastName,
      shortName: request.shortName,
      sex: request.sex,
      country: { code: country.code, pictureUrl: country.pictureUrl },
      pictureUrl: request.pictureUrl,
      rank: stats.rank,
      points: stats.points,
      weightKg: stats.weightKg,
      heightCm: stats.heightCm,
      age: stats.age,
      lastResults: [...stats.lastResults],
    };
  },

  toResponse(player: Player): PlayerResponseDto {
    return {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      shortName: player.shortName,
      sex: player.sex,
      country: { code: player.country.code, pictureUrl: player.country.pictureUrl },
      pictureUrl: player.pictureUrl,
      stats: {
        rank: player.rank,
        points: player.points,
        weightKg: player.weightKg,
        heightCm: player.heightCm,
        age: player.age,
        lastResults: [...player.lastResults],
      },
    };
  },

  toStatsResponse(statistics: PlayersStatistics): StatsResponseDto {
    const { bestCountry } = statistics;
    return {
      bestCountry: bestCountry && {
        code: bestCountry.countryCode,
        winRatio: bestCountry.winRatio,
        wins: bestCountry.wins,
        matches: bestCountry.matches,
      },
      averageBmi: statistics.averageBmi,
      medianHeightCm: statistics.medianHeightCm,
    };
  },
};
