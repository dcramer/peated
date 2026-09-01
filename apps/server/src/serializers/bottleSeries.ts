import { type z } from "zod";
import { serializer } from ".";
import type { BottleSeries } from "../db/schema";
import { formatPeatedId } from "../lib/peatedId";
import { type BottleSeriesSchema } from "../schemas/bottleSeries";

export const BottleSeriesSerializer = serializer({
  name: "bottleSeries",
  item(item: BottleSeries): z.infer<typeof BottleSeriesSchema> {
    return {
      id: item.id,
      peatedId: formatPeatedId("series", item.id),
      name: item.name,
      fullName: item.fullName,
      description: item.description,
      numReleases: item.numReleases,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },
});
