import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { SMWS_DISTILLERY_CODES } from "@peated/server/lib/smws";
import { procedure } from "@peated/server/orpc";
import { EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { sql } from "drizzle-orm";
import { z } from "zod";

const OutputSchema = z.object({
  results: z.array(EntitySchema),
  rel: z.object({
    nextCursor: z.number().nullable(),
    prevCursor: z.number().nullable(),
  }),
});

export default procedure
  .route({ method: "GET", path: "/smws/distillers" })
  .output(OutputSchema)
  .handler(async function ({ context }) {
    const results = await db
      .select()
      .from(entities)
      .where(
        sql`${entities.id} IN (
          SELECT ${entityAliases.entityId} FROM ${entityAliases}
          WHERE LOWER(${entityAliases.name}) IN ${Object.values(SMWS_DISTILLERY_CODES).map((s) => s.toLowerCase())}
        )`,
      );

    return {
      results: await serialize(EntitySerializer, results, context.user),
      rel: {
        nextCursor: null,
        prevCursor: null,
      },
    };
  });
