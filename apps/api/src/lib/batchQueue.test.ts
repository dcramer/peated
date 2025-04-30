import type { Mock } from "vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import BatchQueue from "./batchQueue";

describe("BatchQueue", () => {
  let processBatchMock: Mock;
  let batchQueue: BatchQueue<number>;
  const batchSize = 3;

  beforeEach(() => {
    processBatchMock = vi.fn().mockResolvedValue(undefined);
    batchQueue = new BatchQueue(batchSize, processBatchMock);
  });

  test("processes items when batch size is reached", async () => {
    await batchQueue.push(1);
    await batchQueue.push(2);
    await batchQueue.push(3);

    expect(processBatchMock).toHaveBeenCalledTimes(1);
    expect(processBatchMock).toHaveBeenCalledWith([1, 2, 3]);
  });

  test("does not process items when batch size is not reached", async () => {
    await batchQueue.push(1);
    await batchQueue.push(2);

    expect(processBatchMock).not.toHaveBeenCalled();
  });

  test("processes multiple batches", async () => {
    for (let i = 1; i <= 7; i++) {
      await batchQueue.push(i);
    }

    // Add a small delay to allow for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(processBatchMock).toHaveBeenCalledTimes(2);
    expect(processBatchMock).toHaveBeenNthCalledWith(1, [1, 2, 3]);
    expect(processBatchMock).toHaveBeenNthCalledWith(2, [4, 5, 6]);
  });

  test("handles errors during batch processing", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => new Object());
    processBatchMock.mockRejectedValue(new Error("Processing error"));

    await batchQueue.push(1);
    await batchQueue.push(2);
    await batchQueue.push(3);

    expect(processBatchMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error processing batch:",
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  test("continues processing after an error", async () => {
    processBatchMock
      .mockRejectedValueOnce(new Error("Processing error"))
      .mockResolvedValueOnce(undefined);

    for (let i = 1; i <= 6; i++) {
      await batchQueue.push(i);
    }

    // Add a small delay to allow for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(processBatchMock).toHaveBeenCalledTimes(2);
    expect(processBatchMock).toHaveBeenNthCalledWith(1, [1, 2, 3]);
    expect(processBatchMock).toHaveBeenNthCalledWith(2, [4, 5, 6]);
  });

  test("processes remaining items when queue is not full", async () => {
    await batchQueue.push(1);
    await batchQueue.push(2);
    await batchQueue.push(3);
    await batchQueue.push(4);

    expect(processBatchMock).toHaveBeenCalledTimes(1);
    expect(processBatchMock).toHaveBeenCalledWith([1, 2, 3]);

    await batchQueue.processRemaining();

    // Add a small delay to allow for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(processBatchMock).toHaveBeenCalledTimes(2);
    expect(processBatchMock).toHaveBeenLastCalledWith([4]);
  });

  test("processes all remaining items", async () => {
    for (let i = 1; i <= 7; i++) {
      await batchQueue.push(i);
    }

    // Add a small delay to allow for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(processBatchMock).toHaveBeenCalledTimes(2);
    expect(processBatchMock).toHaveBeenNthCalledWith(1, [1, 2, 3]);
    expect(processBatchMock).toHaveBeenNthCalledWith(2, [4, 5, 6]);

    await batchQueue.processRemaining();

    // Add a small delay to allow for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(processBatchMock).toHaveBeenCalledTimes(3);
    expect(processBatchMock).toHaveBeenLastCalledWith([7]);
  });

  test("does nothing when queue is empty", async () => {
    await batchQueue.processRemaining();

    expect(processBatchMock).not.toHaveBeenCalled();
  });
});
