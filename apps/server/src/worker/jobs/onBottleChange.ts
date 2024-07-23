import { runJob } from "./";

export default async ({ bottleId }: { bottleId: number }) => {
  await runJob("GenerateBottleDetails", { bottleId });
  await runJob("IndexBottleSearchVectors", { bottleId });
  await runJob("UpdateBottleStats", { bottleId });
};
