import { OpenAPIHono } from "@hono/zod-openapi";
import { db } from "@peated/api/db";
import {
  bottleAliases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  changes,
} from "@peated/api/db/schema";
import { processSeries } from "@peated/api/lib/bottleHelpers";
import {
  coerceToUpsert,
  upsertBottleAlias,
  upsertEntity,
} from "@peated/api/lib/db";
import { formatBottleName } from "@peated/api/lib/format";
import { requireAuth } from "@peated/api/middleware/auth";
import { BottleInputSchema, BottleSchema } from "@peated/api/schemas/bottles";
import { serialize } from "@peated/api/serializers";
import { BottleSerializer } from "@peated/api/serializers/bottle";
import { pushJob } from "@peated/api/worker/client";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  ConflictError,
  conflictSchema,
  UnauthorizedError,
  unauthorizedSchema,
} from "http-errors-enhanced";
import { z } from "zod";

export default new OpenAPIHono().openapi(
  {
    method: "post",
    path: "/bottles",
    request: {
      body: {
        content: {
          "application/json": {
            schema: BottleInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ bottle: BottleSchema }),
          },
        },
        description: "Bottle created successfully",
      },
      401: unauthorizedSchema,
      409: conflictSchema,
    },
    tags: ["bottles"],
    summary: "Create a new bottle",
    description: "Creates a new bottle entry in the database.",
    middleware: [requireAuth],
  },
  async (c) => {
    const user = c.get("user");
    if (!user) throw new UnauthorizedError();
    const input = c.req.valid("json");
    const newAliases: string[] = [];
    const newEntityIds: Set<number> = new Set();
    let seriesCreated = false;
    let bottle: any;
    try {
      bottle = await db.transaction(async (tx) => {
        // Brand
        const brandUpsert = await upsertEntity({
          db: tx,
          data: coerceToUpsert(input.brand),
          type: "brand",
          userId: user.id,
        });
        if (!brandUpsert) throw new ConflictError("Could not identify brand.");
        if (brandUpsert.created) newEntityIds.add(brandUpsert.id);
        const brand = brandUpsert.result;

        // Bottler
        let bottler = null;
        if (input.bottler) {
          const bottlerUpsert = await upsertEntity({
            db: tx,
            data: coerceToUpsert(input.bottler),
            type: "bottler",
            userId: user.id,
          });
          if (!bottlerUpsert)
            throw new ConflictError("Could not identify bottler.");
          if (bottlerUpsert.created) newEntityIds.add(bottlerUpsert.id);
          bottler = bottlerUpsert.result;
        }

        // Series
        let seriesId: number | null = null;
        if (input.series) {
          [seriesId, seriesCreated] = await processSeries({
            series: input.series,
            brand,
            userId: user.id,
            tx,
          });
          if (!seriesCreated && seriesId) {
            await tx
              .update(bottleSeries)
              .set({
                numReleases: sql`(SELECT COUNT(*) FROM ${bottles} WHERE ${bottles.seriesId} = ${seriesId}) + 1`,
              })
              .where(eq(bottleSeries.id, seriesId));
          }
        }

        // Distillers
        const distillerIds: number[] = [];
        const distillerList: any[] = [];
        if (input.distillers)
          for (const distData of input.distillers) {
            const distUpsert = await upsertEntity({
              db: tx,
              data: coerceToUpsert(distData),
              userId: user.id,
              type: "distiller",
            });
            if (!distUpsert)
              throw new ConflictError("Could not identify distiller.");
            if (distUpsert.created) newEntityIds.add(distUpsert.id);
            distillerList.push(distUpsert.result);
            distillerIds.push(distUpsert.id);
          }

        // Full name
        const fullName = formatBottleName({
          ...input,
          name: `${brand.shortName || brand.name} ${input.name}`,
        });

        // Bottle insert
        const bottleInsertData = {
          ...input,
          brandId: brand.id,
          bottlerId: bottler?.id || null,
          seriesId,
          createdById: user.id,
          fullName,
        };

        // Alias check
        const alias = await upsertBottleAlias(tx, bottleInsertData.fullName);
        if (alias.bottleId) {
          throw new ConflictError("Bottle already exists.");
        }

        // Insert bottle
        const [bottle] = await tx
          .insert(bottles)
          .values(bottleInsertData)
          .returning();

        // Bind alias
        const [newAlias] = await tx
          .update(bottleAliases)
          .set({ bottleId: bottle.id })
          .where(
            and(
              eq(sql`LOWER(${bottleAliases.name})`, alias.name.toLowerCase()),
              isNull(bottleAliases.bottleId),
            ),
          )
          .returning();
        if (newAlias.bottleId && newAlias.bottleId !== bottle.id) {
          throw new ConflictError("Bottle already exists.");
        }
        newAliases.push(alias.name);

        // Changes and distillers
        const promises: Promise<any>[] = [
          tx.insert(changes).values({
            objectType: "bottle",
            objectId: bottle.id,
            createdAt: bottle.createdAt,
            createdById: user.id,
            displayName: bottle.fullName,
            type: "add",
            data: {
              ...bottle,
              distillerIds,
            },
          }),
        ];
        for (const distillerId of distillerIds) {
          promises.push(
            tx.insert(bottlesToDistillers).values({
              bottleId: bottle.id,
              distillerId,
            }),
          );
        }
        await Promise.all(promises);
        return bottle;
      });
    } catch (err: any) {
      if (err instanceof ConflictError) {
        throw err;
      }
      throw new UnauthorizedError();
    }
    // Async jobs
    try {
      await pushJob("OnBottleChange", { bottleId: bottle.id });
    } catch (err) {
      // Intentionally ignore errors for async job dispatch
    }
    if (bottle.seriesId && seriesCreated) {
      try {
        await pushJob("IndexBottleSeriesSearchVectors", {
          seriesId: bottle.seriesId,
        });
      } catch (err) {
        // Intentionally ignore errors for async job dispatch
      }
    }
    for (const aliasName of newAliases) {
      try {
        await pushJob("OnBottleAliasChange", { name: aliasName });
      } catch (err) {
        // Intentionally ignore errors for async job dispatch
      }
    }
    for (const entityId of newEntityIds.values()) {
      try {
        await pushJob("OnEntityChange", { entityId });
      } catch (err) {
        // Intentionally ignore errors for async job dispatch
      }
    }
    return c.json({
      bottle: await serialize(BottleSerializer, [bottle], user),
    });
  },
);
