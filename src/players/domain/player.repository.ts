import type { NewPlayer, Player, Sex } from './player';

export interface PlayerCriteria {
  readonly sex?: Sex;
  /** ISO 3166-1 alpha-3 country code, upper case. */
  readonly countryCode?: string;
}

/**
 * Port for player persistence. Implementations live in the infrastructure
 * layer (in-memory JSON today, DynamoDB tomorrow) and are injected through
 * {@link PLAYER_REPOSITORY}.
 *
 * Methods are asynchronous so that a remote datastore can be plugged in
 * without changing the callers.
 */
export interface PlayerRepository {
  /** Returns the players matching the criteria, in no particular order. */
  findAll(criteria?: PlayerCriteria): Promise<Player[]>;
  findById(id: number): Promise<Player | undefined>;
  /** Persists a new player under a newly assigned, unique id. */
  create(player: NewPlayer): Promise<Player>;
}

export const PLAYER_REPOSITORY = Symbol('PLAYER_REPOSITORY');
