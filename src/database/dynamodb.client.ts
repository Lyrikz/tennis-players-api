import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface DynamoDbClientOptions {
  /** Custom endpoint, e.g. `http://localhost:8000` for DynamoDB Local. */
  readonly endpoint?: string;
}

/**
 * Document client (plain JS objects instead of attribute-value maps).
 *
 * Against DynamoDB Local, dummy credentials and region are provided so that no
 * AWS account is needed. Otherwise the default AWS credential chain applies
 * (Lambda role, `AWS_PROFILE`, SSO…).
 */
export function createDynamoDbDocumentClient(
  options: DynamoDbClientOptions = {},
): DynamoDBDocumentClient {
  const client = new DynamoDBClient(
    options.endpoint
      ? {
          endpoint: options.endpoint,
          region: process.env.AWS_REGION ?? 'local',
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }
      : {},
  );
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}
