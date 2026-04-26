import { normalizeEntityName } from "@peated/bottle-classifier/normalize";
import { buildCatalogVerificationCreationMetadata } from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import type { NewEntity } from "@peated/server/db/schema";
import {
  changes,
  countries,
  entities,
  regions,
} from "@peated/server/db/schema";
import { queueEntityCreationVerification } from "@peated/server/lib/catalogVerification";
import { upsertEntityAliases } from "@peated/server/lib/db";
import { logError } from "@peated/server/lib/log";
import { buildEntitySearchVector } from "@peated/server/lib/search";
import { procedure } from "@peated/server/orpc";
import {
  requireTosAccepted,
  requireVerified,
} from "@peated/server/orpc/middleware/auth";
import { EntityInputSchema, EntitySchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";

export default procedure
  .use(requireVerified)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/entities",
    summary: "Create entity",
    description:
      "Create a new entity (brand, distillery, or bottler) with location and type information",
    operationId: "createEntity",
  })
  .input(EntityInputSchema)
  .output(EntitySchema)
  .handler(async function ({ input, context, errors }) {
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
    const result = await db.transaction(async (tx) => {
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
          (x) => !existing.type.includes(x),
        );
        if (missingTypes) {
          const [updated] = await tx
            .update(entities)
            .set({
              type: [...existing.type, ...missingTypes],
            })
            .where(eq(entities.name, data.name))
            .returning();
          return {
            entity: updated,
            created: false,
          };
        }
        return null;
      }

      await Promise.all([
        upsertEntityAliases({
          db: tx,
          entity,
        }),
        tx.insert(changes).values({
          objectType: "entity",
          objectId: entity.id,
          displayName: entity.name,
          type: "add",
          createdAt: entity.createdAt,
          createdById: user.id,
          data: {
            ...data,
            catalogVerification:
              buildCatalogVerificationCreationMetadata("manual_entry"),
          },
        }),
      ]);

      return {
        entity,
        created: true,
      };
    });

    if (!result?.entity) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create entity.",
      });
    }

    const { entity, created } = result;

    try {
      await pushJob("OnEntityChange", { entityId: entity.id });
    } catch (err) {
      logError(err, {
        entity: {
          id: entity.id,
        },
      });
    }

    if (created) {
      try {
        await queueEntityCreationVerification({
          entityId: entity.id,
          creationSource: "manual_entry",
        });
      } catch (err) {
        logError(err, {
          entity: {
            id: entity.id,
          },
        });
      }
    }

    return await serialize(EntitySerializer, entity, context.user);
  });
