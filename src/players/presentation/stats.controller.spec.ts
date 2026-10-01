import type { StatsService } from '../application/stats.service';
import { StatsController } from './stats.controller';

describe('StatsController', () => {
  it('maps the statistics to the HTTP contract', async () => {
    const service = {
      getStatistics: jest.fn().mockResolvedValue({
        bestCountry: { countryCode: 'SRB', wins: 5, matches: 5, winRatio: 1 },
        averageBmi: 23.36,
        medianHeightCm: 185,
      }),
    };

    const response = await new StatsController(service as unknown as StatsService).getStatistics();

    expect(response).toEqual({
      bestCountry: { code: 'SRB', winRatio: 1, wins: 5, matches: 5 },
      averageBmi: 23.36,
      medianHeightCm: 185,
    });
  });
});
