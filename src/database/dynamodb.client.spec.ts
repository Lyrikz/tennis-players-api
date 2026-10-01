import { createDynamoDbDocumentClient } from './dynamodb.client';

describe('createDynamoDbDocumentClient', () => {
  it('targets a custom endpoint with dummy credentials (DynamoDB Local)', async () => {
    const client = createDynamoDbDocumentClient({ endpoint: 'http://localhost:8000' });

    const endpoint = await client.config.endpoint?.();
    await expect(client.config.credentials()).resolves.toMatchObject({ accessKeyId: 'local' });
    expect(endpoint).toMatchObject({ hostname: 'localhost', port: 8000 });
  });

  it('relies on the default AWS configuration otherwise', () => {
    const client = createDynamoDbDocumentClient();

    expect(client.config.endpoint).toBeUndefined();
  });
});
