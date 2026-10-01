/** Runtime configuration, read once from the environment. */
export interface AppConfig {
  readonly port: number;
  /** When set, players are served from this DynamoDB table instead of the bundled JSON. */
  readonly playersTableName?: string;
  /** Custom DynamoDB endpoint (DynamoDB Local). */
  readonly dynamoDbEndpoint?: string;
  /** Secret expected in the `x-api-key` header of write requests. Unset: writes are refused. */
  readonly apiKey?: string;
}

/** Below this length, a key can be brute-forced. */
export const MIN_API_KEY_LENGTH = 16;

const DEFAULT_PORT = 3000;

const nonEmpty = (value: string | undefined): string | undefined =>
  value?.trim() ? value.trim() : undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = env.PORT === undefined ? DEFAULT_PORT : Number(env.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(`Invalid PORT "${env.PORT}": expected an integer between 1 and 65535`);
  }
  const apiKey = nonEmpty(env.API_KEY);
  if (apiKey !== undefined && apiKey.length < MIN_API_KEY_LENGTH) {
    throw new Error(`API_KEY must be at least ${MIN_API_KEY_LENGTH} characters long`);
  }
  return {
    port,
    playersTableName: nonEmpty(env.PLAYERS_TABLE_NAME),
    dynamoDbEndpoint: nonEmpty(env.DYNAMODB_ENDPOINT),
    apiKey,
  };
}
