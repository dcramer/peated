import { pushUniqueJob, runJob } from "@peated/server/worker/client";

export default async ({ editionId }: { editionId: number }) => {
  await runJob("IndexBottleEditionSearchVectors", { editionId });
  await pushUniqueJob(
    "UpdateBottleEditionStats",
    { editionId },
    { delay: 5000 },
  );
};
