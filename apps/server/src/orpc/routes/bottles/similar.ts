import { db } from "@peated/server/db";
import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { BottleSchema, CursorSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import type { SQL } from "drizzle-orm";
import {
  and,
  asc,
  eq,
  gte,
  isNotNull,
  lte,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/bottles/{bottle}/similar",
    summary: "Get similar bottles",
    spec: {
      operationId: "getSimilarBottles",
    },
    description:
      "Find bottles similar to the specified bottle based on brand, category, age, and distillery",
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    z.object({
      // TODO: variable output isnt great here
      results: z.array(BottleSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async function ({ input: { limit, ...input }, context, errors }) {
    // maxAge caching for 5 minutes would be handled by oRPC server settings

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, input.bottle));

    if (!bottle) {
      throw errors.NOT_FOUND({
        message: "Bottle not found.",
      });
    }

    // we're just finding vintages right now
    const results = await db
      .select()
      .from(bottles)
      .where(
        and(
          eq(bottles.brandId, bottle.brandId),
          eq(bottles.name, bottle.name),
          ne(bottles.id, bottle.id),
        ),
      )
      .limit(limit)
      .orderBy(asc(bottles.fullName));

    // find similar bottles from the brand

    const where: (SQL<unknown> | undefined)[] = [
      eq(bottles.brandId, bottle.brandId),
      notInArray(bottles.id, [bottle.id, ...results.map((r) => r.id)]),
    ];

    if (bottle.category) where.push(eq(bottles.category, bottle.category));
    if (bottle.statedAge)
      where.push(
        gte(bottles.statedAge, bottle.statedAge - 5),
        lte(bottles.statedAge, bottle.statedAge + 5),
        isNotNull(bottles.statedAge),
      );

    const d1 = alias(bottlesToDistillers, "d1");
    const d2 = alias(bottlesToDistillers, "d2");
    where.push(
      sql`EXISTS (
        SELECT FROM ${bottlesToDistillers} as d1
        INNER JOIN ${bottlesToDistillers} as d2
          ON ${d1.distillerId} = ${d2.distillerId}
        WHERE ${d1.bottleId} = ${bottles.id}
          AND ${d2.bottleId} = ${bottle.id})`,
    );

    results.push(
      ...(await db
        .select()
        .from(bottles)
        .where(and(...where))
        .limit(limit - results.length)
        .orderBy(asc(bottles.fullName))),
    );

    return {
      results: await serialize(
        BottleSerializer,
        results.slice(0, limit),
        context.user,
        ["description", "tastingNotes"],
      ),
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    };
  });
