import { db } from "@peated/server/db";
import {
  bottleReferences,
  bottles,
  bottlesToDistillers,
  countries,
  entities,
  follows,
  regions,
  tastings,
  users,
} from "@peated/server/db/schema";
import { statedAgeBucketWhere } from "@peated/server/lib/ageBuckets";
import { getUserFromId } from "@peated/server/lib/api";
import {
  bottleTextPredicate,
  textSearchQuery,
} from "@peated/server/lib/textSearch";
import { implement } from "@peated/server/orpc";
import tastingListContract from "@peated/server/orpc/contracts/tastings/list";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
export default implement(tastingListContract).handler(async function ({
  input: { cursor, limit, ...input },
  context,
  errors,
}) {
  const offset = (cursor - 1) * limit;

  const baseWhere: (SQL<unknown> | undefined)[] = [isNull(tastings.removedAt)];
  const bottleWhere: SQL<unknown>[] = [];

  if (input.bottle !== undefined) {
    bottleWhere.push(eq(tastings.bottleId, input.bottle));
  }

  if (input.entity) {
    bottleWhere.push(sql`EXISTS(
        SELECT FROM ${bottles}
        WHERE (${bottles.brandId} = ${input.entity}
          OR ${bottles.bottlerId} = ${input.entity}
          OR EXISTS(
            SELECT FROM ${bottlesToDistillers}
            WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
              AND ${bottlesToDistillers.distillerId} = ${input.entity}
          )) AND ${bottles.id} = ${tastings.bottleId}
      )`);
  }

  if (input.query) {
    bottleWhere.push(
      or(
        sql`EXISTS(
          SELECT FROM ${bottleReferences}
          WHERE ${bottleReferences.bottleId} = ${tastings.bottleId}
            AND LOWER(${bottleReferences.name}) = ${input.query.toLowerCase()}
            AND ${bottleReferences.ignored} IS NOT TRUE
        )`,
        bottleTextPredicate(textSearchQuery(input.query, { prefix: true })),
      )!,
    );
  }

  // Same role the member tasting stats count distilleries by.
  if (input.distiller) {
    bottleWhere.push(sql`EXISTS(
        SELECT FROM ${bottlesToDistillers}
        WHERE ${bottlesToDistillers.bottleId} = ${tastings.bottleId}
          AND ${bottlesToDistillers.distillerId} = ${input.distiller}
      )`);
  }

  if (input.ratingBand) {
    bottleWhere.push(eq(tastings.ratingBand, input.ratingBand));
  }

  if (input.age) {
    bottleWhere.push(statedAgeBucketWhere(input.age));
  }

  if (input.region && !input.country) {
    throw errors.BAD_REQUEST({ message: "Region requires country." });
  }
  if (input.country) {
    const [country] = await db
      .select({ id: countries.id })
      .from(countries)
      .where(
        isLocationId(input.country)
          ? eq(countries.id, Number(input.country))
          : eq(sql`LOWER(${countries.slug})`, input.country.toLowerCase()),
      )
      .limit(1);
    if (!country) {
      throw errors.BAD_REQUEST({ message: "Invalid country." });
    }
    let regionId: number | undefined;
    if (input.region) {
      const [region] = await db
        .select({ id: regions.id })
        .from(regions)
        .where(
          and(
            eq(regions.countryId, country.id),
            isLocationId(input.region)
              ? eq(regions.id, Number(input.region))
              : eq(sql`LOWER(${regions.slug})`, input.region.toLowerCase()),
          ),
        )
        .limit(1);
      if (!region) {
        throw errors.BAD_REQUEST({ message: "Invalid region." });
      }
      regionId = region.id;
    }
    // Same location rule as users.regionList: the brand's country and region.
    bottleWhere.push(sql`EXISTS(
        SELECT FROM ${entities}
        WHERE ${entities.id} = ${bottles.brandId}
          AND ${entities.countryId} = ${country.id}
          ${regionId === undefined ? sql`` : sql`AND ${entities.regionId} = ${regionId}`}
      )`);
  }

  if (input.user) {
    const selectedUser = await getUserFromId(db, input.user, context.user);

    if (!selectedUser) {
      if (input.user === "me") {
        throw errors.UNAUTHORIZED();
      } else {
        throw errors.NOT_FOUND({
          message: "User not found.",
        });
      }
    }

    baseWhere.push(eq(tastings.createdById, selectedUser.id));
  }

  const limitPrivate = input.filter !== "friends";
  if (input.filter === "friends") {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    baseWhere.push(
      sql`${tastings.createdById} IN (SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${context.user.id} AND ${follows.status} = 'following')`,
    );
  }

  if (limitPrivate) {
    baseWhere.push(
      or(
        eq(users.private, false),
        ...(context.user
          ? [
              eq(tastings.createdById, context.user.id),
              sql`${tastings.createdById} IN (
                  SELECT ${follows.toUserId} FROM ${follows} WHERE ${follows.fromUserId} = ${context.user.id} AND ${follows.status} = 'following'
                )`,
            ]
          : []),
      ),
    );
  }

  const results = await db
    .select({ tastings })
    .from(tastings)
    .innerJoin(users, eq(users.id, tastings.createdById))
    .innerJoin(bottles, eq(bottles.id, tastings.bottleId))
    .where(and(...baseWhere, ...bottleWhere))
    .limit(limit + 1)
    .offset(offset)
    .orderBy(
      ...(input.sort === "-rating"
        ? // Rating bands sort in their declared order, worst to best.
          [sql`${tastings.ratingBand} DESC NULLS LAST`]
        : input.sort === "name"
          ? [asc(bottles.fullName)]
          : []),
      desc(tastings.createdAt),
      desc(tastings.id),
    );

  // One member's list reports its filtered total; feeds across members skip
  // the count. A short page proves the total unless it is an empty page past
  // the first, so count only when the page cannot.
  const total = !input.user
    ? undefined
    : results.length <= limit && (results.length > 0 || offset === 0)
      ? offset + results.length
      : await db
          .select({ count: sql<string>`COUNT(*)` })
          .from(tastings)
          .innerJoin(users, eq(users.id, tastings.createdById))
          .innerJoin(bottles, eq(bottles.id, tastings.bottleId))
          .where(and(...baseWhere, ...bottleWhere))
          .then(([row]) => Number(row?.count ?? 0));

  return {
    results: await serialize(
      TastingSerializer,
      results.map((t) => t.tastings).slice(0, limit),
      context.user,
    ),
    total,
    rel: {
      nextCursor: results.length > limit ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
});

// Only whole, safe integers are IDs; anything else, such as "1.5", is a slug.
function isLocationId(value: string) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
}
