import type { EntityEvent } from "@peated/server/db/schema";
import type { EntityEventSchema } from "@peated/server/schemas";
import type { z } from "zod";
import { serializer } from ".";

export const EntityEventSerializer = serializer({
  name: "entityEvent",
  item: (event: EntityEvent): z.infer<typeof EntityEventSchema> => ({
    id: event.id,
    entityId: event.entityId,
    kind: event.kind,
    date: event.date,
    description: event.description,
    newOwnerId: event.newOwnerId,
    sourceUrl: event.sourceUrl,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }),
});
