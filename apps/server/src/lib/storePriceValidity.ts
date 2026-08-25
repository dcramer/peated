import { storePrices } from "@peated/server/db/schema";
import { sql } from "drizzle-orm";

export const STORE_PRICE_VALIDITY_DAYS = 7;

export function isStorePriceValid(
  updatedAt: Date,
  now: Date = new Date(),
): boolean {
  const cutoff = new Date(
    now.getTime() - STORE_PRICE_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  );
  return updatedAt > cutoff;
}

export function currentStorePriceCondition() {
  return sql`${storePrices.updatedAt} > NOW() - make_interval(days => ${STORE_PRICE_VALIDITY_DAYS})`;
}
