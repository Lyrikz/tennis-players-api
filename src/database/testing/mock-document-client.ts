import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

/**
 * A real document client (paginators check its type) whose calls are intercepted
 * by `aws-sdk-client-mock`: nothing ever reaches the network.
 */
export function aMockedDocumentClient() {
  const mock = mockClient(DynamoDBDocumentClient);
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: 'eu-west-3',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    }),
  );
  return { mock, client };
}
