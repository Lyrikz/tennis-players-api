import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { batchPut, MAX_BATCH_SIZE } from './batch-write';
import { aMockedDocumentClient } from './testing/mock-document-client';

const TABLE = 'table';

describe('batchPut', () => {
  const { mock: dynamo, client } = aMockedDocumentClient();
  const sleep = jest.fn().mockResolvedValue(undefined);

  const items = (count: number) => Array.from({ length: count }, (_, id) => ({ PK: `ITEM#${id}` }));
  const batchSizes = () =>
    dynamo
      .commandCalls(BatchWriteCommand)
      .map((call) => call.args[0].input.RequestItems?.[TABLE]?.length);

  beforeEach(() => {
    dynamo.reset();
    sleep.mockClear();
  });

  it('writes items by chunks of 25', async () => {
    dynamo.on(BatchWriteCommand).resolves({});

    await batchPut(client, TABLE, items(2 * MAX_BATCH_SIZE + 10), { sleep });

    expect(batchSizes()).toEqual([25, 25, 10]);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does nothing without items', async () => {
    await batchPut(client, TABLE, [], { sleep });

    expect(batchSizes()).toEqual([]);
  });

  it('retries unprocessed items with exponential backoff', async () => {
    const [first, second] = items(2);
    dynamo
      .on(BatchWriteCommand)
      .resolvesOnce({ UnprocessedItems: { [TABLE]: [{ PutRequest: { Item: second! } }] } })
      .resolvesOnce({});

    await batchPut(client, TABLE, [first!, second!], { sleep });

    expect(batchSizes()).toEqual([2, 1]);
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it('gives up after 5 attempts', async () => {
    const [item] = items(1);
    dynamo
      .on(BatchWriteCommand)
      .resolves({ UnprocessedItems: { [TABLE]: [{ PutRequest: { Item: item! } }] } });

    await expect(batchPut(client, TABLE, [item!], { sleep })).rejects.toThrow(
      '1 item(s) still unprocessed after 5 attempts',
    );
    expect(sleep.mock.calls.map(([ms]) => ms as number)).toEqual([100, 200, 400, 800]);
  });

  it('waits for real between attempts by default', async () => {
    jest.useFakeTimers();
    const [item] = items(1);
    dynamo
      .on(BatchWriteCommand)
      .resolvesOnce({ UnprocessedItems: { [TABLE]: [{ PutRequest: { Item: item! } }] } })
      .resolvesOnce({});

    const done = batchPut(client, TABLE, [item!]);
    await jest.advanceTimersByTimeAsync(100);
    await done;
    jest.useRealTimers();

    expect(batchSizes()).toEqual([1, 1]);
  });
});
