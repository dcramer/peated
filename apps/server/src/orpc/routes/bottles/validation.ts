import { ORPCError } from "@orpc/server";
import { parseDetailsFromName } from "@peated/bottle-classifier/smws";
import { db, type AnyDatabase } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { entities, entityTombstones } from "@peated/server/db/schema";
import {
  normalizeBottle,
  stripDuplicateBrandPrefixFromBottleName,
  type NormalizedBottle,
} from "@peated/server/lib/normalize";
import { procedure } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
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
  if (typeof input === "number") {
    const entity = await getEntityById(input, entityDb);
    if (!entity) {
      throw new ORPCError("NOT_FOUND", {
        message: `Entity not found [id: ${input}]`,
      });
    }

    return entity;
  }
  return EntityInputSchema.parse(input);
}

export async function bottleNormalize({
  input,
  context: _context,
  entityDb = db,
}: {
  input: z.infer<typeof BottleInputSchema>;
  context: Context & { user: User };
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
  .handler(async function ({ input, context }) {
    const normalized = await bottleNormalize({
      input,
      context,
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
