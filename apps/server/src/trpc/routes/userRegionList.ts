import { db } from "@peated/server/db";
import {
  bottles,
  countries,
  entities,
  regions,
  tastings,
} from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "..";
import { getUserFromId, profileVisible } from "../../lib/api";

export default publicProcedure
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.number()]),
    }),
  )
  .query(async function ({ input, ctx }) {
    const user = await getUserFromId(db, input.user, ctx.user);
    if (!user) {
      throw new TRPCError({
        message: "User not found.",
        code: "NOT_FOUND",
      });
    }

    if (!(await profileVisible(db, user, ctx.user))) {
      throw new TRPCError({
        message: "User's profile is not public.",
        code: "BAD_REQUEST",
      });
    }

    const results = await db.execute<{
      country_id: number;
      region_id: number;
      count: string;
    }>(
      sql`SELECT country_id, region_id, COUNT(*) as count
    FROM (
      SELECT ${entities.countryId}, ${entities.regionId}
      FROM ${entities}
      INNER JOIN ${bottles}
        ON ${bottles.brandId} = ${entities.id}
      INNER JOIN ${tastings}
        ON ${tastings.bottleId} = ${bottles.id}
      WHERE ${tastings.createdById} = ${user.id}
    ) as t
    GROUP BY country_id, region_id
    ORDER BY count DESC
    LIMIT 25`,
    );

    const countriesById = Object.fromEntries(
      (
        await db
          .select()
          .from(countries)
          .where(
            inArray(
              countries.id,
              results.rows.map((r) => r.country_id),
            ),
          )
      ).map((r) => [
        r.id,
        {
          name: r.name,
          slug: r.slug,
        },
      ]),
    );

    const regionsById = Object.fromEntries(
      (
        await db
          .select()
          .from(regions)
          .where(
            inArray(
              regions.id,
              results.rows.map((r) => r.region_id),
            ),
          )
      ).map((r) => [
        r.id,
        {
          name: r.name,
          slug: r.slug,
        },
      ]),
    );

    const totalCount = Number(
      (
        await db.execute<{ count: string }>(
          sql<{ count: number }>`SELECT COUNT(*) as count
        FROM ${tastings}
        WHERE ${tastings.createdById} = ${user.id}
      `,
        )
      ).rows[0]!.count,
    );

    return {
      results: results.rows.map(({ country_id, region_id, count }) => ({
        country: countriesById[country_id],
        region: region_id ? regionsById[region_id] : null,
        count: Number(count),
      })),
      totalCount,
    };
  });
