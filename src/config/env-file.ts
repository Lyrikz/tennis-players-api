import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Loads `.env` into the environment when the file exists (local development
 * only: Lambda gets its variables from its configuration). Variables already
 * set, e.g. exported in the shell, take precedence over the file.
 */
export function loadEnvFile(path = '.env', env: NodeJS.ProcessEnv = process.env): boolean {
  if (!existsSync(path)) {
    return false;
  }
  for (const [name, value] of Object.entries(parseEnv(readFileSync(path, 'utf8')))) {
    env[name] ??= value;
  }
  return true;
}
