import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { isFactShown } from "@peated/server/lib/entityAbout/display";
import { toLegacyEvent } from "@peated/server/lib/entityAbout/legacyEvents";
import {
  followMergedEntities,
  getEntityAbout,
} from "@peated/server/lib/entityAbout/store";
import { implement } from "@peated/server/orpc";
import entityEventListContract from "@peated/server/orpc/contracts/entities/events/list";
import { eq } from "drizzle-orm";

export default implement(entityEventListContract).handler(async function ({
  input,
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

  const about = await getEntityAbout(db, entity.id);
  const document = about?.document;
  const owners = await followMergedEntities(
    db,
    (document?.events ?? []).flatMap((event) =>
      event.newOwnerId ? [event.newOwnerId] : [],
    ),
  );
  const results = (document?.events ?? [])
    // Display rule: history without a source stays hidden.
    .filter((event) => isFactShown(event.citations, document?.sources ?? []))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .flatMap((event) => {
      const legacy = toLegacyEvent(entity.id, event, document?.sources ?? []);
      if (!legacy) return [];
      // An owner merged into another Entity is shown as the one it became.
      const newOwnerId = legacy.newOwnerId
        ? (owners.get(legacy.newOwnerId) ?? legacy.newOwnerId)
        : null;
      // An owner merged into this Entity would read as it buying itself.
      if (newOwnerId === entity.id) return [];
      return [{ ...legacy, newOwnerId }];
    });

  return { results };
});
