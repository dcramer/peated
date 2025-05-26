import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({ method: "POST", path: "/entities/{entity}/merge" })
  .input(
    z.object({
      entity: z.coerce.number(),
      other: z.number(),
      direction: z.enum(["mergeInto", "mergeFrom"]).default("mergeInto"),
    }),
  )
  .output(EntitySchema)
  .handler(async function ({ input, context, errors }) {
    if (input.entity === input.other) {
      throw errors.BAD_REQUEST({
        message: "Cannot merge an entity into itself.",
      });
    }

    const [rootEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.entity));

    if (!rootEntity) {
      throw errors.NOT_FOUND({
        message: "Entity not found.",
      });
    }

    const [otherEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, input.other));

    if (!otherEntity) {
      throw errors.NOT_FOUND({
        message: "Other entity not found.",
      });
    }

    // if mergeInto, rootEntity merges into otherEntity
    const fromEntity =
      input.direction === "mergeInto" ? rootEntity : otherEntity;
    const toEntity = input.direction === "mergeInto" ? otherEntity : rootEntity;

    await pushJob("MergeEntity", {
      toEntityId: toEntity.id,
      fromEntityIds: [fromEntity.id],
    });

    return await serialize(EntitySerializer, toEntity, context.user);
  });
