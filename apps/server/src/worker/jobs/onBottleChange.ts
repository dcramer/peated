import { pushUniqueJob, runJob } from "@peated/server/worker/client";

export default async ({ bottleId }: { bottleId: number }) => {
  await runJob("GenerateBottleDetails", { bottleId });
  await runJob("IndexBottleSearchVectors", { bottleId });
  await pushUniqueJob("UpdateBottleStats", { bottleId }, { delay: 5000 });
};
