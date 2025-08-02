import { db } from "@peated/server/db";
import {
  bottles,
  countries,
  entities,
  regions,
  tastings,
} from "@peated/server/db/schema";
import { getUserFromId, profileVisible } from "@peated/server/lib/api";
import { procedure } from "@peated/server/orpc";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/users/{user}/regions",
    summary: "List user regions",
    description:
      "Retrieve regions from bottles tasted by a user with tasting counts. Respects privacy settings",
    operationId: "listUserRegions",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          country: z.object({
            name: z.string(),
            slug: z.string(),
          }),
          region: z
            .object({
              name: z.string(),
              slug: z.string(),
            })
            .nullable(),
          count: z.number(),
        }),
      ),
      totalCount: z.number(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    const user = await getUserFromId(db, input.user, context.user);
    if (!user) {
      throw errors.NOT_FOUND({
        message: "User not found.",
      });
    }

    if (!(await profileVisible(db, user, context.user))) {
      throw errors.BAD_REQUEST({
        message: "User's profile is not public.",
      });
    }

    const results = await db.execute<{
      country_id: number;
      region_id: number;
      count: string;
    }>(
      sql`
      SELECT ${entities.countryId}, ${entities.regionId}, COUNT(*) as count
      FROM ${entities}
      INNER JOIN ${bottles}
        ON ${bottles.brandId} = ${entities.id}
      INNER JOIN ${tastings}
        ON ${tastings.bottleId} = ${bottles.id}
      WHERE ${tastings.createdById} = ${user.id}
      GROUP BY country_id, region_id
      ORDER BY COUNT(*) DESC
      LIMIT 25`,
    );

    const countryIds = Array.from(
      new Set(results.rows.map((r) => r.country_id)),
    );
    const countriesById = countryIds.length
      ? Object.fromEntries(
          (
            await db
              .select()
              .from(countries)
              .where(inArray(countries.id, countryIds))
          ).map((r) => [
            r.id,
            {
              name: r.name,
              slug: r.slug,
            },
          ]),
        )
      : {};

    const regionIds = Array.from(new Set(results.rows.map((r) => r.region_id)));
    const regionsById = regionIds.length
      ? Object.fromEntries(
          (
            await db
              .select()
              .from(regions)
              .where(inArray(regions.id, regionIds))
          ).map((r) => [
            r.id,
            {
              name: r.name,
              slug: r.slug,
            },
          ]),
        )
      : {};

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
