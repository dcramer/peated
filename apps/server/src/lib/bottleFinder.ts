import { ilike, sql } from "drizzle-orm";
import { db } from "../db";
import { bottles } from "../db/schema";

export async function findBottle(name: string): Promise<{ id: number } | null> {
  let bottle: { id: number } | null | undefined;

  // exact match
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(ilike(bottles.fullName, name))
    .limit(1);
  if (bottle) return bottle;

  // match the store's listing as a prefix
  // name: Aberfeldy 18-year-old Single Malt Scotch Whisky
  // bottle.fullName: Aberfeldy 18-year-old
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(sql`${name} ILIKE '%' || ${bottles.fullName} || '%'`)
    .orderBy(bottles.fullName)
    .limit(1);
  if (bottle) return bottle;

  // match our names are prefix as a last resort (this isnt often correct)
  // name: Aberfeldy 18-year-old
  // bottle.fullName: Aberfeldy 18-year-old Super Series
  [bottle] = await db
    .select({ id: bottles.id })
    .from(bottles)
    .where(ilike(bottles.fullName, `${name} %`))
    .orderBy(bottles.fullName)
    .limit(1);

  return bottle;
}
