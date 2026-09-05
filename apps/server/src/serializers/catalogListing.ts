import type { CatalogListing } from "@peated/server/db/schema";
import type { CatalogListingSchema } from "@peated/server/schemas";
import type { z } from "zod";
import { serializer } from ".";

export const CatalogListingSerializer = serializer({
  name: "catalogListing",
  item: (item: CatalogListing): z.infer<typeof CatalogListingSchema> => ({
    externalProductId: item.externalProductId,
    name: item.name,
    url: item.url,
    imageUrl: item.imageUrl,
    volume: item.volume,
    sourceBottleIdentity: item.sourceBottleIdentity,
    firstSeenAt: item.firstSeenAt.toISOString(),
    lastSeenAt: item.lastSeenAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }),
});
