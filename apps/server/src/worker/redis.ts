import IORedis from "ioredis";
import config from "../config";

declare global {
  // The package alias and relative imports can load this module twice in one
  // process, so the shared connection lives on globalThis like the pg pool.
  var __peatedRedisConnection: IORedis | null | undefined;
}

export async function getConnection() {
  if (globalThis.__peatedRedisConnection) {
    return globalThis.__peatedRedisConnection;
  }

  const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  globalThis.__peatedRedisConnection = connection;

  return connection;
}

export function disconnectConnection() {
  globalThis.__peatedRedisConnection?.disconnect();
  globalThis.__peatedRedisConnection = null;
}
