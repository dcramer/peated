import { eq, sql } from "drizzle-orm";
import { db, type AnyDatabase } from "../db";
import { bottleAliases, entities, type Entity } from "../db/schema";

export async function findBottleTarget(
  name: string,
  database: AnyDatabase = db,
): Promise<{ bottleId: number; releaseId: number | null } | null> {
  const [result] = await database
    .select({
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
    })
    .from(bottleAliases)
    .where(eq(sql`LOWER(${bottleAliases.name})`, sql`LOWER(${name})`))
    .limit(1);

  if (!result?.bottleId) {
    return null;
  }

  return {
    bottleId: result.bottleId,
    releaseId: result.releaseId ?? null,
  };
}

export async function findBottleId(
  name: string,
  database: AnyDatabase = db,
): Promise<number | null> {
  const target = await findBottleTarget(name, database);
  if (target?.bottleId) return target.bottleId;

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
  return null;
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
