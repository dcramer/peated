import IORedis from "ioredis";
import config from "../config";

let connection: IORedis | null = null;

export async function getConnection() {
  if (connection) return connection;

  connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  return connection;
}

export function disconnectConnection() {
  if (connection) connection.disconnect();
  connection = null;
}
