import { aFakePlayerRepository } from '../testing/fake-player.repository';
import { aPlayer, fromCountry, L, W } from '../testing/player.fixture';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  let repository: ReturnType<typeof aFakePlayerRepository>;
  let service: StatsService;

  beforeEach(() => {
    repository = aFakePlayerRepository();
    service = new StatsService(repository);
  });

  it('computes rounded statistics over all players', async () => {
    repository.findAll.mockResolvedValue([
      aPlayer({ ...fromCountry('SRB'), weightKg: 80, heightCm: 188, lastResults: [W, W, L] }),
      aPlayer({ ...fromCountry('USA'), weightKg: 74, heightCm: 185, lastResults: [W, L, L] }),
    ]);

    const statistics = await service.getStatistics();

    expect(repository.findAll).toHaveBeenCalledWith();
    expect(statistics).toEqual({
      // 2 / 3 = 0.6666…
      bestCountry: { countryCode: 'SRB', wins: 2, matches: 3, winRatio: 0.67 },
      // (22.6347… + 21.6216…) / 2 = 22.128…
      averageBmi: 22.13,
      medianHeightCm: 186.5,
    });
  });

  it('returns null statistics when there is no player', async () => {
    await expect(service.getStatistics()).resolves.toEqual({
      bestCountry: null,
      averageBmi: null,
      medianHeightCm: null,
    });
  });
});
