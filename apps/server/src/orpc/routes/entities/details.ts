import { db } from "@peated/server/db";
import { entities, entityTombstones } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { EntitySchema, detailsResponse } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/entities/{entity}",
    summary: "Get entity details",
    description:
      "Retrieve detailed information about a specific entity (brand, distillery, or bottler)",
    operationId: "getEntity",
  })
  .input(z.object({ entity: z.coerce.number() }))
  // TODO(response-envelope): wrap in { data } by updating detailsResponse() at cutover
  .output(detailsResponse(EntitySchema))
  .handler(async function ({ input, context, errors }) {
    const { entity: entityId } = input;

    let [entity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entityId));
    if (!entity) {
      // check for a tombstone
      [entity] = await db
        .select({
          ...getTableColumns(entities),
        })
        .from(entityTombstones)
        .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
        .where(eq(entityTombstones.entityId, entityId));
      if (!entity) {
        throw errors.NOT_FOUND({
          message: "Entity not found.",
        });
      }
    }

    return await serialize(EntitySerializer, entity, context.user);
  });
