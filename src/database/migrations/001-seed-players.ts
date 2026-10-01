import playersFile from '../../players/infrastructure/data/players.json';
import { toPlayerItem } from '../../players/infrastructure/dynamodb/player.item';
import { toPlayer } from '../../players/infrastructure/raw-player.mapper';
import { batchPut } from '../batch-write';
import type { Migration } from './migration';

/**
 * Imports the dataset provided by the client. The raw format is converted by the
 * same mapper as the in-memory repository (grams → kilograms, validation).
 */
export const seedPlayers: Migration = {
  id: '001-seed-players',
  description: 'Import the initial players dataset',
  async up({ client, tableName, log }) {
    const items = playersFile.players.map(toPlayer).map(toPlayerItem);
    await batchPut(client, tableName, items);
    log(`Imported ${items.length} players`);
  },
};
