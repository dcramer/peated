import { db } from "@peated/server/db";
import { entities, entityEvents } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import entityEventListContract from "@peated/server/orpc/contracts/entities/events/list";
import { serialize } from "@peated/server/serializers";
import { EntityEventSerializer } from "@peated/server/serializers/entityEvent";
import { asc, eq } from "drizzle-orm";

export default implement(entityEventListContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.id, input.entity))
    .limit(1);
  if (!entity) {
    throw errors.NOT_FOUND({ message: "Entity not found." });
  }

  const events = await db
    .select()
    .from(entityEvents)
    .where(eq(entityEvents.entityId, entity.id))
    .orderBy(asc(entityEvents.date), asc(entityEvents.id));

  return {
    results: await serialize(EntityEventSerializer, events, context.user),
  };
});
