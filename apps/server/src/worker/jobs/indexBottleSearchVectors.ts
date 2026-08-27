import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleSeries,
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { logInfo } from "@peated/server/lib/log";
import { buildBottleSearchVector } from "@peated/server/lib/search";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import type { JobPayload } from "../types";

export const IndexBottleSearchVectorsJobArgsSchema = z
  .object({
    bottleId: z.number().int().positive(),
  })
  .strict();

export default async function indexBottleSearchVectors(input: JobPayload) {
  const { bottleId } = IndexBottleSearchVectorsJobArgsSchema.parse(input);

  const bottle = await db.query.bottles.findFirst({
    where: (bottles, { eq }) => eq(bottles.id, bottleId),
  });
  if (!bottle) return;

  const aliasList = await db
    .select({
      name: bottleAliases.name,
    })
    .from(bottleAliases)
    .where(
      and(
        eq(bottleAliases.bottleId, bottle.id),
        sql`${bottleAliases.ignored} IS NOT TRUE`,
      ),
    );

  const distillerList = await db
    .select({
      ...getTableColumns(entities),
    })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, bottle.brandId));
  if (!brand) return;

  const [bottler] = bottle.bottlerId
    ? await db.select().from(entities).where(eq(entities.id, bottle.bottlerId))
    : [];

  const [series] = bottle.seriesId
    ? await db
        .select()
        .from(bottleSeries)
        .where(eq(bottleSeries.id, bottle.seriesId))
    : [];

  const searchVector =
    buildBottleSearchVector(
      bottle,
      brand,
      aliasList,
      bottler,
      distillerList,
      series,
    ) || null;

  logInfo("Updating search vector for bottle {bottleId}", {
    extra: {
      bottleId: bottle.id,
    },
  });

  await db
    .update(bottles)
    .set({
      searchVector,
    })
    .where(eq(bottles.id, bottle.id));
}
