import { runJob } from "@peated/api/worker/client";

export default async ({ releaseId }: { releaseId: number }) => {
  await runJob("IndexBottleReleaseSearchVectors", { releaseId });
};
