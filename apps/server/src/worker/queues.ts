import { Queue } from "bullmq";

import IORedis from "ioredis";
import config from "../config";

export function getConnection() {
  return new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export const defaultConnection = getConnection();

export const defaultQueue = new Queue("default", {
  connection: defaultConnection,
});
