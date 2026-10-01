import { Global, Module } from '@nestjs/common';
import { type AppConfig, loadConfig } from './app.config';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Exposes the configuration, read and validated once at startup, to the whole application. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: (): AppConfig => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
