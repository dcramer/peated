import { runJob } from "./";

export default async ({ entityId }: { entityId: number }) => {
  await runJob("GenerateEntityDetails", { entityId });
  await runJob("IndexEntitySearchVectors", { entityId });
  await runJob("GeocodeEntityLocation", { entityId });
  await runJob("UpdateEntityStats", { entityId });
};
