import { PlayerNotFoundException, Sex } from '../domain';
import { aFakePlayerRepository } from '../testing/fake-player.repository';
import { aPlayer } from '../testing/player.fixture';
import { PlayersService } from './players.service';

describe('PlayersService', () => {
  let repository: ReturnType<typeof aFakePlayerRepository>;
  let service: PlayersService;

  beforeEach(() => {
    repository = aFakePlayerRepository();
    service = new PlayersService(repository);
  });

  describe('findAll', () => {
    it('sorts players by official rank, ignoring points', async () => {
      repository.findAll.mockResolvedValue([
        aPlayer({ id: 52, rank: 2, points: 2542 }),
        aPlayer({ id: 95, rank: 52, points: 1105 }),
        aPlayer({ id: 17, rank: 1, points: 1982 }),
      ]);

      const players = await service.findAll();

      expect(players.map((player) => player.id)).toEqual([17, 52, 95]);
    });

    it('forwards the criteria to the repository', async () => {
      const criteria = { sex: Sex.Female, countryCode: 'USA' };

      await service.findAll(criteria);

      expect(repository.findAll).toHaveBeenCalledWith(criteria);
    });

    it('returns an empty list when nothing matches', async () => {
      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    it('delegates the creation to the repository', async () => {
      const { id: _id, ...newPlayer } = aPlayer();
      const created = { ...newPlayer, id: 103 };
      repository.create.mockResolvedValue(created);

      await expect(service.create(newPlayer)).resolves.toBe(created);
      expect(repository.create).toHaveBeenCalledWith(newPlayer);
    });
  });

  describe('findById', () => {
    it('returns the player', async () => {
      const player = aPlayer({ id: 17 });
      repository.findById.mockResolvedValue(player);

      await expect(service.findById(17)).resolves.toBe(player);
      expect(repository.findById).toHaveBeenCalledWith(17);
    });

    it('throws PlayerNotFoundException when the player does not exist', async () => {
      await expect(service.findById(999)).rejects.toThrow(new PlayerNotFoundException(999));
    });
  });
});
