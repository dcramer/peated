import { db } from "@peated/server/db";
import { pushUniqueJob, runJob } from "@peated/server/worker/client";

export default async ({ entityId }: { entityId: number }) => {
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
