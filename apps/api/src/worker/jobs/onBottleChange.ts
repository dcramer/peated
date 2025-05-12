import { pushUniqueJob, runJob } from "@peated/api/worker/client";

export default async ({ bottleId }: { bottleId: number }) => {
  await runJob("GenerateBottleDetails", { bottleId });
  await runJob("IndexBottleSearchVectors", { bottleId });
  await pushUniqueJob("UpdateBottleStats", { bottleId }, { delay: 5000 });
};
