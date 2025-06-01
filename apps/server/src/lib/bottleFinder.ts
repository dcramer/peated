import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { type Entity, bottleAliases, entities } from "../db/schema";

export async function findBottleId(name: string): Promise<number | null> {
  let result: { id: number | null } | null | undefined;

  // exact match
  [result] = await db
    .select({ id: bottleAliases.bottleId })
    .from(bottleAliases)
    .where(eq(sql`LOWER(${bottleAliases.name})`, sql`LOWER(${name})`))
    .limit(1);
  if (result?.id) return result?.id;

  // TODO: improve this, but until then we're relying on humans
  // // match the store's listing as a prefix
  // // name: Aberfeldy 18-year-old Single Malt Scotch Whisky
  // // bottle.fullName: Aberfeldy 18-year-old
  // [result] = await db
  //   .select({ id: bottleAliases.bottleId })
  //   .from(bottleAliases)
  //   .where(sql`${name} ILIKE ${bottleAliases.name} || '%'`)
  //   .orderBy(sql`LENGTH(${bottleAliases.name}) DESC`)
  //   .limit(1);
  // if (result) return result?.id;

  // // match our names are prefix as a last resort (this isnt often correct)
  // // name: Aberfeldy 18-year-old
  // // bottle.fullName: Aberfeldy 18-year-old Super Series
  // [result] = await db
  //   .select({ id: bottleAliases.bottleId })
  //   .from(bottleAliases)
  //   .where(ilike(bottleAliases.name, `${name} %`))
  //   .orderBy(sql`LENGTH(${bottleAliases.name})`)
  //   .limit(1);

  return result?.id || null;
}

export async function findEntity(fullName: string): Promise<Entity | null> {
  const [result] = await db
    .select()
    .from(entities)
    .where(sql`${fullName} ILIKE ${entities.name} || '%'`)
    // .where(sql`${entities.name} ~* ANY (string_to_array(${fullName}, ' '))`)
    .orderBy(sql`LENGTH(${entities.name})`)
    .limit(1);

  return result ?? null;
}
