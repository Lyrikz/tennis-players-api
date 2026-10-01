import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PlayersModule } from './players/players.module';

@Module({ imports: [ConfigModule, HealthModule, PlayersModule] })
export class AppModule {}
