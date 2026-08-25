import { ORPCError } from "@orpc/server";
import {
  normalizeBottle,
  stripDuplicateBrandPrefixFromBottleName,
  type NormalizedBottle,
} from "@peated/bottle-classifier/normalize";
import { parseDetailsFromName } from "@peated/bottle-classifier/smws";
import { db, type AnyDatabase } from "@peated/server/db";
import { entities, entityTombstones } from "@peated/server/db/schema";
import { findEntityByExactNameOrAlias } from "@peated/server/lib/db";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import {
  BottleInputSchema,
  EntityInputSchema,
  EntitySchema,
} from "@peated/server/schemas";
import { type BottlePreviewResult } from "@peated/server/types";
import { eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";

async function getEntityById(entityId: number, entityDb: AnyDatabase) {
  let [entity] = await entityDb
    .select()
    .from(entities)
    .where(eq(entities.id, entityId));

  if (!entity) {
    [entity] = await entityDb
      .select({
        ...getTableColumns(entities),
      })
      .from(entityTombstones)
      .innerJoin(entities, eq(entityTombstones.newEntityId, entities.id))
      .where(eq(entityTombstones.entityId, entityId));
  }

  if (!entity) {
    return null;
  }

  return EntitySchema.parse({
    id: entity.id,
    peatedId: formatPeatedId("entity", entity.id),
    name: entity.name,
    shortName: entity.shortName,
    type: entity.type,
    description: entity.description,
    descriptionSrc: entity.descriptionSrc,
    yearEstablished: entity.yearEstablished,
    website: entity.website,
    country: null,
    region: null,
    address: entity.address,
    location: entity.location,
    totalTastings: entity.totalTastings,
    totalBottles: entity.totalBottles,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  });
}

async function getEntity(
  input: number | z.input<typeof EntityInputSchema>,
  entityDb: AnyDatabase,
) {
  const entityId = z.number().safeParse(input);
  if (entityId.success) {
    const entity = await getEntityById(entityId.data, entityDb);
    if (!entity) {
      throw new ORPCError("NOT_FOUND", {
        message: `Entity not found [id: ${entityId.data}]`,
      });
    }

    return entity;
  }
  const parsedInput = EntityInputSchema.parse(input);
  const existingEntity = await findEntityByExactNameOrAlias(
    entityDb,
    parsedInput.name,
  );

  if (!existingEntity) {
    return parsedInput;
  }

  return EntitySchema.parse({
    id: existingEntity.id,
    peatedId: formatPeatedId("entity", existingEntity.id),
    name: existingEntity.name,
    shortName: existingEntity.shortName,
    type: existingEntity.type,
    description: existingEntity.description,
    descriptionSrc: existingEntity.descriptionSrc,
    yearEstablished: existingEntity.yearEstablished,
    website: existingEntity.website,
    country: null,
    region: null,
    address: existingEntity.address,
    location: existingEntity.location,
    totalTastings: existingEntity.totalTastings,
    totalBottles: existingEntity.totalBottles,
    createdAt: existingEntity.createdAt.toISOString(),
    updatedAt: existingEntity.updatedAt.toISOString(),
  });
}

export async function bottleNormalize({
  input,
  entityDb = db,
}: {
  input: z.infer<typeof BottleInputSchema>;
  entityDb?: AnyDatabase;
}): Promise<BottlePreviewResult & NormalizedBottle> {
  const brand = await getEntity(input.brand, entityDb);

  const rv: BottlePreviewResult = {
    ...input,
    category: input.category ?? null,
    brand,
    bottler: null,
    distillers: null,
    statedAge: input.statedAge ?? null,
    flavorProfile: input.flavorProfile ?? null,
  };

  if (rv.brand?.name.toLowerCase() === "the scotch malt whisky society") {
    rv.bottler = rv.brand;

    if (input.name) {
      const details = parseDetailsFromName(input.name);
      if (details) {
        rv.name = details.name;

        if (details.category) rv.category = details.category;

        if (details.distiller) {
          const distiller = await getEntity(
            {
              name: details.distiller,
            },
            entityDb,
          );
          if (distiller) rv.distillers = [distiller];
        }
      }
    }
  }

  if (!rv.bottler && input.bottler) {
    rv.bottler = await getEntity(input.bottler, entityDb);
  }

  if (!rv.distillers && input.distillers) {
    rv.distillers = await Promise.all(
      input.distillers.map((d) => getEntity(d, entityDb)),
    );
  }

  // remove duplicate brand name prefix on bottle name
  // e.g. Hibiki 12-year-old => Hibiki
  if (rv.brand) {
    rv.name = stripDuplicateBrandPrefixFromBottleName(rv.name, rv.brand.name);
  }

  let normalized: NormalizedBottle = {
    name: rv.name,
    statedAge: rv.statedAge ?? null,
    vintageYear: null,
    releaseYear: null,
    caskStrength: null,
    singleCask: null,
  };

  if (rv.name) {
    normalized = normalizeBottle({
      ...rv,
      isFullName: false,
    });
  }

  return {
    ...rv,
    ...normalized,
  };
}

const BottlePreviewResultSchema = z.object({
  name: z.string(),
  statedAge: z.number().nullable(),
  vintageYear: z.number().nullable(),
  releaseYear: z.number().nullable(),
  caskStrength: z.boolean().nullish(),
  singleCask: z.boolean().nullish(),
});

export default procedure
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/bottles/validations",
    summary: "Validate bottle data",
    description:
      "Validate and normalize bottle information including name parsing, entity resolution, and data standardization",
    spec: (spec) => ({
      ...spec,
      operationId: "validateBottle",
    }),
  })
  .input(BottleInputSchema)
  .output(BottlePreviewResultSchema)
  .handler(async function ({ input }) {
    const normalized = await bottleNormalize({
      input,
    });

    // Extract only the properties specified in the output schema
    return {
      name: normalized.name,
      statedAge: normalized.statedAge,
      vintageYear: normalized.vintageYear,
      releaseYear: normalized.releaseYear,
      caskStrength: normalized.caskStrength,
      singleCask: normalized.singleCask,
    };
  });
