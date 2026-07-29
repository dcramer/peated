import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import pg from "pg";

const { Client } = pg;

export function createPostgresClient(): InstanceType<typeof Client> {
  return new Client(getPostgresConnectionConfig());
}

export async function waitForSessionBlockedBy(
  client: InstanceType<typeof Client>,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Bottle alias lock.");
}
