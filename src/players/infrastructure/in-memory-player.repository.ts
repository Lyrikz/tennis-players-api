import type { NewPlayer, Player, PlayerCriteria, PlayerRepository } from '../domain';
import playersFile from './data/players.json';
import type { RawPlayersFile } from './raw-player';
import { toPlayer } from './raw-player.mapper';

/**
 * Read-only repository backed by the static JSON dataset.
 *
 * The JSON is imported (not read from disk) so it is embedded in the bundle.
 * Created players only live as long as the process: this implementation is
 * meant for local development and tests, DynamoDB is the persistent store.
 */
export class InMemoryPlayerRepository implements PlayerRepository {
  private readonly players: Player[];

  constructor(source: RawPlayersFile = playersFile) {
    this.players = source.players.map(toPlayer);
  }

  findAll(criteria: PlayerCriteria = {}): Promise<Player[]> {
    const { sex, countryCode } = criteria;
    return Promise.resolve(
      this.players.filter(
        (player) =>
          (sex === undefined || player.sex === sex) &&
          (countryCode === undefined || player.country.code === countryCode),
      ),
    );
  }

  findById(id: number): Promise<Player | undefined> {
    return Promise.resolve(this.players.find((player) => player.id === id));
  }

  create(newPlayer: NewPlayer): Promise<Player> {
    const lastId = Math.max(0, ...this.players.map(({ id }) => id));
    const player: Player = { ...newPlayer, id: lastId + 1 };
    this.players.push(player);
    return Promise.resolve(player);
  }
}
