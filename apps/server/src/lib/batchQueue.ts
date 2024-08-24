export default class BatchQueue<T> {
  private queue: T[] = [];
  private batchSize: number;
  private processingBatch = false;
  private processBatchCallback: (batch: T[]) => Promise<void>;

  constructor(
    batchSize: number,
    processBatchCallback: (batch: T[]) => Promise<void>,
  ) {
    this.batchSize = batchSize;
    this.processBatchCallback = processBatchCallback;
  }

  async push(item: T): Promise<void> {
    this.queue.push(item);
    return this.checkBatchSize();
  }

  async processRemaining(): Promise<void> {
    while (this.queue.length > 0) {
      await this.processBatch();
    }
  }

  private async checkBatchSize(): Promise<void> {
    while (this.queue.length >= this.batchSize && !this.processingBatch) {
      this.processBatch();
      await this.checkBatchSize(); // Check again in case more items were added
    }
  }

  private async processBatch(): Promise<void> {
    this.processingBatch = true;
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await this.processBatchCallback(batch);
    } catch (error) {
      console.error("Error processing batch:", error);
    } finally {
      this.processingBatch = false;
    }
  }
}
