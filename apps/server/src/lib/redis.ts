import config from "@peated/server/config";
import IORedis from "ioredis";

let client: IORedis | null = null;

export function getRedis(): IORedis {
  if (client) return client;
  client = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  return client;
}
