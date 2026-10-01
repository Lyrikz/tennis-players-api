import { Sex } from '../domain';
import { aPlayer } from '../testing/player.fixture';
import { InMemoryPlayerRepository } from './in-memory-player.repository';

describe('InMemoryPlayerRepository', () => {
  describe('with the bundled dataset', () => {
    const repository = new InMemoryPlayerRepository();

    it('loads every player', async () => {
      const players = await repository.findAll();

      expect(players.map((player) => player.id).sort((a, b) => a - b)).toEqual([
        17, 52, 65, 95, 102,
      ]);
    });

    it('filters by sex', async () => {
      const players = await repository.findAll({ sex: Sex.Female });

      expect(players.map((player) => player.lastName)).toEqual(['Williams', 'Williams']);
    });

    it('filters by country code', async () => {
      const players = await repository.findAll({ countryCode: 'SRB' });

      expect(players.map((player) => player.id)).toEqual([52]);
    });

    it('combines filters', async () => {
      await expect(repository.findAll({ sex: Sex.Male, countryCode: 'USA' })).resolves.toEqual([]);
    });

    it('finds a player by id', async () => {
      const player = await repository.findById(17);

      expect(player).toMatchObject({ lastName: 'Nadal', weightKg: 85, heightCm: 185 });
    });

    it('returns undefined for an unknown id', async () => {
      await expect(repository.findById(999)).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('assigns the next id after the highest existing one', async () => {
      const repository = new InMemoryPlayerRepository();
      const { id: _id, ...newPlayer } = aPlayer({ lastName: 'Alcaraz' });

      const created = await repository.create(newPlayer);
      const next = await repository.create(newPlayer);

      expect([created.id, next.id]).toEqual([103, 104]);
      await expect(repository.findById(103)).resolves.toEqual(created);
      await expect(repository.findAll()).resolves.toHaveLength(7);
    });

    it('starts at 1 on an empty data source', async () => {
      const repository = new InMemoryPlayerRepository({ players: [] });
      const { id: _id, ...newPlayer } = aPlayer();

      await expect(repository.create(newPlayer)).resolves.toMatchObject({ id: 1 });
    });
  });

  it('accepts an injected data source', async () => {
    const repository = new InMemoryPlayerRepository({ players: [] });

    await expect(repository.findAll()).resolves.toEqual([]);
  });
});
