import {
  BatchWriteCommand,
  type BatchWriteCommandInput,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

type WriteRequest = NonNullable<BatchWriteCommandInput['RequestItems']>[string][number];

/** DynamoDB limit for a single BatchWriteItem call. */
export const MAX_BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 100;

export interface BatchPutOptions {
  /** Injectable for tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Upserts items by chunks of 25, retrying unprocessed items (throttling) with
 * exponential backoff, as recommended by AWS.
 */
export async function batchPut(
  client: DynamoDBDocumentClient,
  tableName: string,
  items: readonly Record<string, unknown>[],
  { sleep = defaultSleep }: BatchPutOptions = {},
): Promise<void> {
  for (let start = 0; start < items.length; start += MAX_BATCH_SIZE) {
    let requests: WriteRequest[] = items
      .slice(start, start + MAX_BATCH_SIZE)
      .map((Item) => ({ PutRequest: { Item } }));

    for (let attempt = 1; requests.length > 0; attempt++) {
      if (attempt > MAX_ATTEMPTS) {
        throw new Error(
          `${requests.length} item(s) still unprocessed after ${MAX_ATTEMPTS} attempts`,
        );
      }
      if (attempt > 1) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 2));
      }
      const { UnprocessedItems } = await client.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: requests } }),
      );
      requests = UnprocessedItems?.[tableName] ?? [];
    }
  }
}
