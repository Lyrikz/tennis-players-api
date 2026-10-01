import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile } from './env-file';

describe('loadEnvFile', () => {
  let directory: string;
  let path: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'env-file-'));
    path = join(directory, '.env');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads the variables of the file', () => {
    writeFileSync(path, 'API_KEY=from-file # comment\nexport QUOTED="a value"\n');
    const env: NodeJS.ProcessEnv = {};

    expect(loadEnvFile(path, env)).toBe(true);
    expect(env).toEqual({ API_KEY: 'from-file', QUOTED: 'a value' });
  });

  it('keeps variables already set in the shell', () => {
    writeFileSync(path, 'API_KEY=from-file\nPORT=4000\n');
    const env: NodeJS.ProcessEnv = { API_KEY: 'from-shell' };

    loadEnvFile(path, env);

    expect(env).toEqual({ API_KEY: 'from-shell', PORT: '4000' });
  });

  it('does nothing when the file does not exist', () => {
    const env: NodeJS.ProcessEnv = {};

    expect(loadEnvFile(join(directory, 'missing.env'), env)).toBe(false);
    expect(env).toEqual({});
  });

  it('targets process.env by default', () => {
    expect(loadEnvFile(join(directory, 'missing.env'))).toBe(false);
  });
});
