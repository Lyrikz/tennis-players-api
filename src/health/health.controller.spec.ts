import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports the service as up with its uptime', () => {
    jest.spyOn(process, 'uptime').mockReturnValue(42);

    expect(new HealthController().check()).toEqual({ status: 'ok', uptime: 42 });
  });
});
