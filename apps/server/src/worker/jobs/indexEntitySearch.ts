import { db } from "@peated/server/db";
import {
  entities,
  entityAliases,
  entityReferences,
} from "@peated/server/db/schema";
import { logInfo } from "@peated/server/lib/log";
import { buildEntitySearchDocument } from "@peated/server/lib/search";
import type { JobPayload } from "@peated/server/worker/types";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const IndexEntitySearchJobArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
  })
  .strict();

export default async (input: JobPayload) => {
  const { entityId } = IndexEntitySearchJobArgsSchema.parse(input);

  const entity = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, entityId),
  });
  if (!entity) return;

  const [references, aliases] = await Promise.all([
    db
      .select({ name: entityReferences.name })
      .from(entityReferences)
      .where(eq(entityReferences.entityId, entity.id)),
    db
      .select({ name: entityAliases.name })
      .from(entityAliases)
      .where(eq(entityAliases.entityId, entity.id)),
  ]);

  logInfo("Updating search document for entity {entityId}", {
    extra: {
      entityId: entity.id,
    },
  });

  await db
    .update(entities)
    .set(buildEntitySearchDocument(entity, [...references, ...aliases]))
    .where(eq(entities.id, entity.id));
};
