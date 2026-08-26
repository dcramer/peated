import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { absoluteUrl } from "@peated/server/lib/urls";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware/auth";
import { BottleGroupV1Fields, BottleV1Schema } from "@peated/server/schemas";
import { z } from "zod";

const BottleEditChoiceSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
  })
  .strict();

const BottleEditSharedContextSchema = z
  .object({
    name: BottleGroupV1Fields.name,
    statedAge: BottleGroupV1Fields.statedAge,
    brand: BottleEditChoiceSchema,
    distillers: z.array(BottleEditChoiceSchema),
    bottler: BottleEditChoiceSchema.nullable(),
    series: BottleEditChoiceSchema.nullable(),
    category: BottleGroupV1Fields.category,
    flavorProfile: BottleGroupV1Fields.flavorProfile,
  })
  .strict();

const BottleEditExactContextSchema = BottleV1Schema.pick({
  edition: true,
  statedAge: true,
  noAgeStatement: true,
  abv: true,
  singleCask: true,
  caskStrength: true,
  naturalColor: true,
  nonChillFiltered: true,
  maltPhenolPpm: true,
  vintageYear: true,
  bottlingYear: true,
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
  .handler(async function ({ input, errors }) {
    try {
      return await db.transaction(async (tx) => {
        await resolveActiveBottleIds(tx, [input.bottle]);
        const bottle = await tx.query.bottles.findFirst({
          where: (bottles, { eq }) => eq(bottles.id, input.bottle),
          with: {
            group: {
              with: {
                brand: true,
                bottler: true,
                series: true,
                distillers: { with: { distiller: true } },
              },
            },
          },
        });
        if (!bottle?.group) {
          throw new ActiveBottleSelectionError("unassigned", input.bottle);
        }

        const { group } = bottle;
        if (!group.brand) {
          throw errors.CONFLICT({
            message: `BottleGroup ${group.id} is missing its Brand.`,
          });
        }
        if (group.bottlerId !== null && !group.bottler) {
          throw errors.CONFLICT({
            message: `BottleGroup ${group.id} is missing its Bottler.`,
          });
        }
        if (group.seriesId !== null && !group.series) {
          throw errors.CONFLICT({
            message: `BottleGroup ${group.id} is missing its Series.`,
          });
        }
        const distillerRows = [...group.distillers].sort(
          (left, right) => left.distillerId - right.distillerId,
        );
        if (distillerRows.some(({ distiller }) => !distiller)) {
          throw errors.CONFLICT({
            message: `BottleGroup ${group.id} is missing a Distiller.`,
          });
        }

        return {
          bottleId: bottle.id,
          totalBottles: group.totalBottles,
          shared: {
            name: group.name,
            statedAge: group.statedAge,
            brand: { id: group.brand.id, name: group.brand.name },
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
            category: group.category,
            flavorProfile: group.flavorProfile,
          },
          exact: {
            edition: bottle.edition,
            statedAge:
              bottle.statedAge !== null && bottle.statedAge !== group.statedAge
                ? bottle.statedAge
                : null,
            noAgeStatement: bottle.noAgeStatement,
            abv: bottle.abv,
            singleCask: bottle.singleCask,
            caskStrength: bottle.caskStrength,
            naturalColor: bottle.naturalColor,
            nonChillFiltered: bottle.nonChillFiltered,
            maltPhenolPpm: bottle.maltPhenolPpm,
            vintageYear: bottle.vintageYear,
            bottlingYear: bottle.bottlingYear,
            releaseYear: bottle.releaseYear,
            caskSize: bottle.caskSize,
            caskType: bottle.caskType,
            caskFill: bottle.caskFill,
            description: bottle.description,
            descriptionSrc: bottle.descriptionSrc,
            imageUrl: bottle.imageUrl
              ? absoluteUrl(config.API_SERVER, bottle.imageUrl)
              : null,
          },
        };
      });
    } catch (error) {
      if (error instanceof ActiveBottleSelectionError) {
        if (error.reason === "missing") {
          throw errors.NOT_FOUND({ message: error.message, cause: error });
        }
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
