import {
  type NewPlayer,
  type Player,
  type PlayerCriteria,
  PlayerNotFoundException,
  type PlayerRepository,
} from '../domain';

/** Official ranking order: rank 1 first. */
const byRank = (a: Player, b: Player): number => a.rank - b.rank;

/**
 * Player use cases. Plain TypeScript: wired into Nest by `PlayersModule`,
 * which keeps this layer independent from the framework and trivial to test.
 */
export class PlayersService {
  constructor(private readonly repository: PlayerRepository) {}

  /**
   * Players matching the criteria, from best to worst.
   *
   * Sorting relies on the official `rank` rather than on `points`: the dataset
   * is inconsistent on this point (Nadal is ranked 1 with fewer points than
   * Djokovic, ranked 2) and the ranking is the source of truth.
   */
  async findAll(criteria: PlayerCriteria = {}): Promise<Player[]> {
    const players = await this.repository.findAll(criteria);
    return [...players].sort(byRank);
  }

  /** @throws PlayerNotFoundException */
  async findById(id: number): Promise<Player> {
    const player = await this.repository.findById(id);
    if (!player) {
      throw new PlayerNotFoundException(id);
    }
    return player;
  }

  /** Registers a player; its id is assigned by the repository. */
  create(newPlayer: NewPlayer): Promise<Player> {
    return this.repository.create(newPlayer);
  }
}
