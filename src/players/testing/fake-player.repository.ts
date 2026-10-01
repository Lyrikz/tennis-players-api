import type { PlayerRepository } from '../domain';

/** Jest-mocked repository, typed against the port. */
export function aFakePlayerRepository(): jest.Mocked<PlayerRepository> {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(undefined),
    create: jest.fn(),
  };
}
