import { Queue } from "bullmq";

import IORedis from "ioredis";
import config from "../config";

export async function getConnection() {
  return new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export const defaultConnection = await getConnection();

export const defaultQueue = new Queue("default", {
  connection: defaultConnection,
});
