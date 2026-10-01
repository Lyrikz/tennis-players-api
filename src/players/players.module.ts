import { Logger, Module } from '@nestjs/common';
import type { AppConfig } from '../config/app.config';
import { APP_CONFIG } from '../config/config.module';
import { PlayersService } from './application/players.service';
import { StatsService } from './application/stats.service';
import { PLAYER_REPOSITORY, type PlayerRepository } from './domain';
import { createPlayerRepository } from './infrastructure/player-repository.factory';
import { PlayersController } from './presentation/players.controller';
import { StatsController } from './presentation/stats.controller';

/**
 * Composition root of the players feature. Application services are plain
 * classes, so they are wired explicitly through factories.
 */
@Module({
  controllers: [PlayersController, StatsController],
  providers: [
    {
      provide: PLAYER_REPOSITORY,
      useFactory: (config: AppConfig): PlayerRepository => {
        const repository = createPlayerRepository(config);
        new Logger(PlayersModule.name).log(`Player repository: ${repository.constructor.name}`);
        return repository;
      },
      inject: [APP_CONFIG],
    },
    {
      provide: PlayersService,
      useFactory: (repository: PlayerRepository) => new PlayersService(repository),
      inject: [PLAYER_REPOSITORY],
    },
    {
      provide: StatsService,
      useFactory: (repository: PlayerRepository) => new StatsService(repository),
      inject: [PLAYER_REPOSITORY],
    },
  ],
})
export class PlayersModule {}
