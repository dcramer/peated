import { pushUniqueJob, runJob } from "@peated/server/worker/client";

export default async ({ entityId }: { entityId: number }) => {
  await runJob("GenerateEntityDetails", { entityId });
  await runJob("IndexEntitySearchVectors", { entityId });
  await runJob("GeocodeEntityLocation", { entityId });
  await pushUniqueJob("UpdateEntityStats", { entityId }, { delay: 5000 });
};
