import { db } from "@peated/server/db";
import { bottleGroups } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetNotFoundError,
  CatalogTargetResolutionError,
  loadCatalogTargetByBottleId,
} from "@peated/server/lib/catalogTargets";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware/auth";
import {
  BottleGroupV1Schema,
  ConcreteBottleV1Schema,
} from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { z } from "zod";

const BottleEditChoiceSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
  })
  .strict();

const BottleEditSharedContextSchema = z
  .object({
    name: BottleGroupV1Schema.shape.name,
    statedAge: BottleGroupV1Schema.shape.statedAge,
    brand: BottleEditChoiceSchema,
    distillers: z.array(BottleEditChoiceSchema),
    bottler: BottleEditChoiceSchema.nullable(),
    series: BottleEditChoiceSchema.nullable(),
    category: BottleGroupV1Schema.shape.category,
    flavorProfile: BottleGroupV1Schema.shape.flavorProfile,
  })
  .strict();

const BottleEditExactContextSchema = ConcreteBottleV1Schema.pick({
  edition: true,
  abv: true,
  singleCask: true,
  caskStrength: true,
  vintageYear: true,
  releaseYear: true,
  caskSize: true,
  caskType: true,
  caskFill: true,
  description: true,
  descriptionSrc: true,
  imageUrl: true,
}).strict();

export const BottleEditContextSchema = z
  .object({
    bottleId: z.number().int().positive(),
    totalBottles: z.number().int().positive(),
    shared: BottleEditSharedContextSchema,
    exact: BottleEditExactContextSchema,
  })
  .strict();

/**
 * Form-only moderator projection: shared values come from BottleGroup authority
 * and exact values from the selected Bottle. Ordinary Bottle reads stay
 * independently complete and do not depend on this group hydration.
 */
export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/{bottle}/edit-context",
    summary: "Get bottle edit context",
    description:
      "Load group-owned shared choices and Bottle-owned exact values for moderator editing",
    spec: (spec) => ({
      ...spec,
      operationId: "getBottleEditContext",
    }),
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }).strict())
  .output(BottleEditContextSchema)
  .handler(async function ({ input, context, errors }) {
    try {
      const target = await loadCatalogTargetByBottleId(input.bottle, {
        actor: await getUserActor(context.user),
        permissions: { canReadCatalogIdentity: true },
      });
      if (target.kind !== "bottle") {
        throw new CatalogTargetIntegrityMismatchError(
          { bottleId: input.bottle },
          "the Bottle resolved to a generic target",
        );
      }

      const group = await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, target.group.id),
        with: {
          brand: true,
          bottler: true,
          series: true,
          distillers: { with: { distiller: true } },
        },
      });
      if (!group) {
        throw new CatalogTargetIntegrityMismatchError(
          { bottleId: input.bottle },
          "the BottleGroup edit context could not be hydrated",
        );
      }

      const distillerRows = [...group.distillers].sort(
        (left, right) => left.distillerId - right.distillerId,
      );

      return {
        bottleId: target.bottle.id,
        totalBottles: target.group.totalBottles,
        shared: {
          name: target.group.name,
          statedAge: target.group.statedAge,
          brand: { id: group.brand!.id, name: group.brand!.name },
          distillers: distillerRows.map(({ distiller }) => ({
            id: distiller!.id,
            name: distiller!.name,
          })),
          bottler:
            group.bottlerId !== null
              ? { id: group.bottler!.id, name: group.bottler!.name }
              : null,
          series:
            group.seriesId !== null
              ? { id: group.series!.id, name: group.series!.name }
              : null,
          category: target.group.category,
          flavorProfile: target.group.flavorProfile,
        },
        exact: {
          edition: target.bottle.edition,
          abv: target.bottle.abv,
          singleCask: target.bottle.singleCask,
          caskStrength: target.bottle.caskStrength,
          vintageYear: target.bottle.vintageYear,
          releaseYear: target.bottle.releaseYear,
          caskSize: target.bottle.caskSize,
          caskType: target.bottle.caskType,
          caskFill: target.bottle.caskFill,
          description: target.bottle.description,
          descriptionSrc: target.bottle.descriptionSrc,
          imageUrl: target.bottle.imageUrl,
        },
      };
    } catch (error) {
      if (error instanceof CatalogTargetNotFoundError) {
        const existingBottle = await db.query.bottles.findFirst({
          where: (bottles, { eq }) => eq(bottles.id, input.bottle),
          columns: { id: true },
        });
        if (existingBottle) {
          throw errors.CONFLICT({ message: error.message, cause: error });
        }
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
