import { runJob } from "./";

export default async ({ bottleId }: { bottleId: number }) => {
  runJob("GenerateBottleDetails", { bottleId });
  runJob("IndexBottleSearchVectors", { bottleId });
  runJob("UpdateBottleStats", { bottleId });
};
