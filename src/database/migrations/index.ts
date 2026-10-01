import { seedPlayers } from './001-seed-players';
import { initPlayerIdCounter } from './002-init-player-id-counter';
import type { Migration } from './migration';

/** Ordered list of all migrations. Append only. */
export const MIGRATIONS: readonly Migration[] = [seedPlayers, initPlayerIdCounter];

export type { Migration, MigrationContext } from './migration';
export { MigrationRunner } from './migration-runner';
