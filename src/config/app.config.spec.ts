import { loadConfig } from './app.config';

describe('loadConfig', () => {
  it('provides defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      playersTableName: undefined,
      dynamoDbEndpoint: undefined,
      apiKey: undefined,
    });
  });

  it('reads the API key', () => {
    expect(loadConfig({ API_KEY: 'a-sufficiently-long-key' }).apiKey).toBe(
      'a-sufficiently-long-key',
    );
  });

  it('rejects an API key that is too short to be safe', () => {
    expect(() => loadConfig({ API_KEY: 'short' })).toThrow(
      'API_KEY must be at least 16 characters long',
    );
  });

  it('reads the environment', () => {
    expect(
      loadConfig({
        PORT: '4000',
        PLAYERS_TABLE_NAME: ' players ',
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
      }),
    ).toEqual({
      port: 4000,
      playersTableName: 'players',
      dynamoDbEndpoint: 'http://localhost:8000',
      apiKey: undefined,
    });
  });

  it('treats blank values as unset', () => {
    expect(loadConfig({ PLAYERS_TABLE_NAME: '  ' }).playersTableName).toBeUndefined();
  });

  it.each(['abc', '0', '70000', '3.5'])('rejects PORT=%p', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(`Invalid PORT "${port}"`);
  });
});
