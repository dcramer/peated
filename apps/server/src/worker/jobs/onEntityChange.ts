import { db } from "@peated/server/db";
import { pushUniqueJob, runJob } from "@peated/server/worker/client";
import type { JobPayload } from "@peated/server/worker/types";
import { z } from "zod";

export const OnEntityChangeJobArgsSchema = z
  .object({
    entityId: z.number().int().positive(),
  })
  .strict();

export default async (input: JobPayload) => {
  const { entityId } = OnEntityChangeJobArgsSchema.parse(input);

  const entity = await db.query.entities.findFirst({
    columns: { id: true },
    where: (entities, { eq }) => eq(entities.id, entityId),
  });
  // Entity change jobs can outlive a delete or merge. Missing rows mean that
  // this queued work is stale, so no derived entity state remains to update.
  if (!entity) return;

  await runJob("GenerateEntityDetails", { entityId });
  await runJob("IndexEntitySearchVectors", { entityId });
  await runJob("GeocodeEntityLocation", { entityId });
  await pushUniqueJob("UpdateEntityStats", { entityId }, { delay: 5000 });
};
