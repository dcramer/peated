import { db } from "@peated/server/db";
import { loginRequests } from "@peated/server/db/schema";
import { sql } from "drizzle-orm";

export default async function cleanupLoginRequests() {
  // Delete expired requests past their expiry + 24h grace period
  // (Consumed requests are already deleted immediately on consumption)
  const result = await db
    .delete(loginRequests)
    .where(sql`${loginRequests.expiresAt} < NOW() - INTERVAL '24 hours'`);

  console.log(`Cleaned up ${result.rowCount ?? 0} expired login requests`);
}
