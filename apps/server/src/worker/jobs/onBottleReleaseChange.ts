import { runJob } from "@peated/server/worker/client";

export default async ({ releaseId }: { releaseId: number }) => {
  await runJob("IndexBottleReleaseSearchVectors", { releaseId });
};
