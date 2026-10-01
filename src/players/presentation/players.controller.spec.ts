import { PlayerNotFoundException, Sex } from '../domain';
import { PlayersService } from '../application/players.service';
import { aFakePlayerRepository } from '../testing/fake-player.repository';
import { aPlayer } from '../testing/player.fixture';
import type { Response } from 'express';
import type { CreatePlayerRequestDto } from './dto/create-player.request.dto';
import { PlayersController } from './players.controller';

describe('PlayersController', () => {
  let service: jest.Mocked<Pick<PlayersService, 'findAll' | 'findById' | 'create'>>;
  let controller: PlayersController;

  beforeEach(() => {
    service = { findAll: jest.fn(), findById: jest.fn(), create: jest.fn() };
    controller = new PlayersController(service as unknown as PlayersService);
  });

  it('translates the query into domain criteria and maps players to DTOs', async () => {
    service.findAll.mockResolvedValue([aPlayer({ id: 17, rank: 1 })]);

    const response = await controller.findAll({ sex: Sex.Male, country: 'ESP' });

    expect(service.findAll).toHaveBeenCalledWith({ sex: Sex.Male, countryCode: 'ESP' });
    expect(response).toEqual([
      expect.objectContaining({ id: 17, stats: expect.objectContaining({ rank: 1 }) }),
    ]);
  });

  it('returns the requested player', async () => {
    service.findById.mockResolvedValue(aPlayer({ id: 52, lastName: 'Djokovic' }));

    await expect(controller.findOne(52)).resolves.toMatchObject({ id: 52, lastName: 'Djokovic' });
  });

  it('creates a player and points the Location header to it', async () => {
    const { id: _id, ...newPlayer } = aPlayer({ lastName: 'Alcaraz', rank: 3 });
    service.create.mockResolvedValue({ ...newPlayer, id: 103 });
    const response = { location: jest.fn() };
    const body: CreatePlayerRequestDto = {
      firstName: newPlayer.firstName,
      lastName: newPlayer.lastName,
      shortName: newPlayer.shortName,
      sex: newPlayer.sex,
      country: { ...newPlayer.country },
      pictureUrl: newPlayer.pictureUrl,
      stats: {
        rank: newPlayer.rank,
        points: newPlayer.points,
        weightKg: newPlayer.weightKg,
        heightCm: newPlayer.heightCm,
        age: newPlayer.age,
        lastResults: [...newPlayer.lastResults],
      },
    };

    const created = await controller.create(body, response as unknown as Response);

    expect(service.create).toHaveBeenCalledWith(newPlayer);
    expect(response.location).toHaveBeenCalledWith('/api/v1/players/103');
    expect(created).toMatchObject({ id: 103, lastName: 'Alcaraz', stats: { rank: 3 } });
  });

  it('lets domain exceptions propagate to the exception filter', async () => {
    const service = new PlayersService(aFakePlayerRepository());

    await expect(new PlayersController(service).findOne(1)).rejects.toBeInstanceOf(
      PlayerNotFoundException,
    );
  });
});
