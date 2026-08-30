import config from "@peated/server/config";
import type { EntityImage } from "@peated/server/db/schema";
import { absoluteUrl } from "@peated/server/lib/urls";
import type { EntityImageSchema } from "@peated/server/schemas";
import type { z } from "zod";
import { serializer } from ".";

export const EntityImageSerializer = serializer({
  name: "entityImage",
  item: (image: EntityImage): z.infer<typeof EntityImageSchema> => ({
    id: image.id,
    entityId: image.entityId,
    imageUrl: absoluteUrl(config.API_SERVER, image.imageUrl),
    caption: image.caption,
    isPrimary: image.isPrimary,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  }),
});
