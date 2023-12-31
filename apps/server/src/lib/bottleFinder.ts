import { ilike, sql } from "drizzle-orm";
import { db } from "../db";
import { bottleAliases, bottles } from "../db/schema";

export async function findBottleId(name: string): Promise<number | null> {
  let result: { id: number | null } | null | undefined;

  // exact match
  [result] = await db
    .select({ id: bottleAliases.bottleId })
    .from(bottleAliases)
    .where(ilike(bottleAliases.name, name))
    .limit(1);
  if (result?.id) return result?.id;

  // match the store's listing as a prefix
  // name: Aberfeldy 18-year-old Single Malt Scotch Whisky
  // bottle.fullName: Aberfeldy 18-year-old
  [result] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(sql`${name} ILIKE '%' || ${bottles.fullName} || '%'`)
    .orderBy(bottles.fullName)
    .limit(1);
  if (result) return result?.id;

  // match our names are prefix as a last resort (this isnt often correct)
  // name: Aberfeldy 18-year-old
  // bottle.fullName: Aberfeldy 18-year-old Super Series
  [result] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(ilike(bottles.fullName, `${name} %`))
    .orderBy(bottles.fullName)
    .limit(1);

  return result?.id || null;
}
