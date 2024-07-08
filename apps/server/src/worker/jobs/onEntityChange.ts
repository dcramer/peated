import { runJob } from "./";

export default async ({ entityId }: { entityId: number }) => {
  runJob("GenerateEntityDetails", { entityId });
  runJob("IndexEntitySearchVectors", { entityId });
  runJob("GeocodeEntityLocation", { entityId });
  runJob("UpdateEntityStats", { entityId });
};
