import { AGE_BUCKETS, type AgeBucketId } from "@peated/server/constants";
import { bottles } from "@peated/server/db/schema";
import type { SQL } from "drizzle-orm";
import { isNull, sql } from "drizzle-orm";

/**
 * Matches Bottles whose stated age falls in one age range, the same ranges
 * member age stats count by. `unstated` matches Bottles without a stated age.
 */
export function statedAgeBucketWhere(age: AgeBucketId): SQL {
  if (age === "unstated") return isNull(bottles.statedAge);
  const { min, max } = AGE_BUCKETS.find(({ id }) => id === age)!;
  if (min === null) return sql`${bottles.statedAge} <= ${max}`;
  if (max === null) return sql`${bottles.statedAge} >= ${min}`;
  return sql`${bottles.statedAge} BETWEEN ${min} AND ${max}`;
}
