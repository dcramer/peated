import { db } from "@peated/server/db";
import type { NewEntity } from "@peated/server/db/schema";
import {
  changes,
  countries,
  entities,
  entityAliases,
  regions,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { normalizeEntityName } from "@peated/server/lib/normalize";
import { buildEntitySearchVector } from "@peated/server/lib/search";
import { procedure } from "@peated/server/orpc";
import { requireVerified } from "@peated/server/orpc/middleware/auth";
import { EntityInputSchema, EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";

export default procedure
  .use(requireVerified)
  .route({
    method: "POST",
    path: "/entities",
    summary: "Create entity",
    description:
      "Create a new entity (brand, distillery, or bottler) with location and type information",
  })
  .input(EntityInputSchema)
  .output(EntitySchema)
  .handler(async ({ input, context, errors }) => {
    const data: NewEntity = {
      ...input,
      name: normalizeEntityName(input.name),
      type: input.type || [],
      createdById: context.user.id,
    };

    if (input.country) {
      const [country] = await db
        .select()
        .from(countries)
        .where(eq(countries.id, input.country))
        .limit(1);
      if (!country) {
        throw errors.NOT_FOUND({
          message: "Country not found.",
        });
      }
      data.countryId = country.id;

      if (input.region) {
        const [region] = await db
          .select()
          .from(regions)
          .where(eq(regions.id, input.region))
          .limit(1);
        if (!region || region.countryId !== data.countryId) {
          throw errors.NOT_FOUND({
            message: "Region not found.",
          });
        }
        data.regionId = region.id;
      }
    }

    if (data.description && data.description !== "") {
      data.descriptionSrc =
        input.descriptionSrc ||
        (input.description && input.description !== null ? "user" : null);
    }

    const user = context.user;
    const entity = await db.transaction(async (tx) => {
      const [entity] = await tx
        .insert(entities)
        .values({
          ...data,
          searchVector: buildEntitySearchVector(data),
        })
        .onConflictDoNothing()
        .returning();

      if (!entity) {
        // see if we can update an existing entity to add a type
        const [existing] = await tx
          .select()
          .from(entities)
          .where(eq(entities.name, data.name));
        const missingTypes = data.type.filter(
          (x) => !existing.type.includes(x)
        );
        if (missingTypes) {
          const [updated] = await tx
            .update(entities)
            .set({
              type: [...existing.type, ...missingTypes],
            })
            .where(eq(entities.name, data.name))
            .returning();
          return updated;
        }
        return null;
      }

      // TODO: handle existing duplicate
      const promises: Promise<any>[] = [
        tx.insert(entityAliases).values({
          entityId: entity.id,
          name: entity.name,
          createdAt: entity.createdAt,
        }),
        tx.insert(changes).values({
          objectType: "entity",
          objectId: entity.id,
          displayName: entity.name,
          type: "add",
          createdAt: entity.createdAt,
          createdById: user.id,
          data: data,
        }),
      ];

      if (entity.shortName) {
        promises.push(
          tx.insert(entityAliases).values({
            entityId: entity.id,
            name: entity.shortName,
            createdAt: entity.createdAt,
          })
        );
      }

      if (entity.name.startsWith("The ")) {
        promises.push(
          tx.insert(entityAliases).values({
            entityId: entity.id,
            name: entity.name.substring(4),
            createdAt: entity.createdAt,
          })
        );
      }

      await Promise.all(promises);

      return entity;
    });

    if (!entity) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create entity.",
      });
    }

    try {
      await pushJob("OnEntityChange", { entityId: entity.id });
    } catch (err) {
      logError(err, {
        entity: {
          id: entity.id,
        },
      });
    }

    return await serialize(EntitySerializer, entity, context.user);
  });
