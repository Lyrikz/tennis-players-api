import { TableSchema } from '../../../database/table-schema';
import { type MatchResult, MAX_RANK, type Player, type Sex } from '../../domain';

export const PLAYER_ENTITY = 'Player';

/** Rank is zero-padded so that the lexicographic order of sort keys is the numeric order. */
const RANK_DIGITS = String(MAX_RANK).length;

/** Key builders of the Player entity (see `TableSchema`). */
const PLAYER_PREFIX = 'PLAYER#';

export const PlayerKeys = {
  /** Common prefix of every player partition key (used in IAM conditions). */
  partitionKeyPrefix: PLAYER_PREFIX,
  partitionKey: (id: number): string => `${PLAYER_PREFIX}${id}`,
  sortKey: 'PROFILE',
  allPlayers: 'PLAYERS',
  country: (code: string): string => `COUNTRY#${code}`,
  rank: (rank: number): string => {
    if (!Number.isInteger(rank) || rank < 1 || rank > MAX_RANK) {
      throw new RangeError(`Rank must be an integer between 1 and ${MAX_RANK}, got ${rank}`);
    }
    return `RANK#${String(rank).padStart(RANK_DIGITS, '0')}`;
  },
} as const;

const { partitionKey, sortKey, entityType, indexes } = TableSchema;

/**
 * Atomic counter handing out player ids (`UpdateItem ADD`): unique even under
 * concurrent creations. Initialised by migration `002-init-player-id-counter`.
 */
export const PlayerIdCounter = {
  key: { [partitionKey]: 'COUNTER', [sortKey]: 'PLAYER' },
  attribute: 'currentValue',
} as const;

/**
 * A player as stored in DynamoDB: keys + flattened attributes.
 * (A type alias rather than an interface, so that it is assignable to an item record.)
 */
export type PlayerItem = {
  readonly [partitionKey]: string;
  readonly [sortKey]: string;
  readonly [indexes.byRank.partitionKey]: string;
  readonly [indexes.byRank.sortKey]: string;
  readonly [indexes.byCountry.partitionKey]: string;
  readonly [indexes.byCountry.sortKey]: string;
  readonly [entityType]: typeof PLAYER_ENTITY;
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly shortName: string;
  readonly sex: Sex;
  readonly countryCode: string;
  readonly countryPictureUrl: string;
  readonly pictureUrl: string;
  readonly rank: number;
  readonly points: number;
  readonly weightKg: number;
  readonly heightCm: number;
  readonly age: number;
  readonly lastResults: MatchResult[];
};

export function toPlayerItem(player: Player): PlayerItem {
  const rankKey = PlayerKeys.rank(player.rank);
  return {
    [partitionKey]: PlayerKeys.partitionKey(player.id),
    [sortKey]: PlayerKeys.sortKey,
    [indexes.byRank.partitionKey]: PlayerKeys.allPlayers,
    [indexes.byRank.sortKey]: rankKey,
    [indexes.byCountry.partitionKey]: PlayerKeys.country(player.country.code),
    [indexes.byCountry.sortKey]: rankKey,
    [entityType]: PLAYER_ENTITY,
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    shortName: player.shortName,
    sex: player.sex,
    countryCode: player.country.code,
    countryPictureUrl: player.country.pictureUrl,
    pictureUrl: player.pictureUrl,
    rank: player.rank,
    points: player.points,
    weightKg: player.weightKg,
    heightCm: player.heightCm,
    age: player.age,
    lastResults: [...player.lastResults],
  };
}

/** Items are written by our own migrations: their shape is trusted. */
export function fromPlayerItem(item: Record<string, unknown>): Player {
  const stored = item as unknown as PlayerItem;
  return {
    id: stored.id,
    firstName: stored.firstName,
    lastName: stored.lastName,
    shortName: stored.shortName,
    sex: stored.sex,
    country: { code: stored.countryCode, pictureUrl: stored.countryPictureUrl },
    pictureUrl: stored.pictureUrl,
    rank: stored.rank,
    points: stored.points,
    weightKg: stored.weightKg,
    heightCm: stored.heightCm,
    age: stored.age,
    lastResults: stored.lastResults,
  };
}
