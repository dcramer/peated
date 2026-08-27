import { z } from "zod";
import { CategoryEnum, EntityKindEnum } from "../classifierTypes";

const LocalCatalogEntitySchema = z
  .object({
    id: z.number().int(),
    name: z.string().trim().min(1),
    shortName: z.string().trim().min(1).nullable().default(null),
    aliases: z.array(z.string().trim().min(1)).default([]),
    kind: EntityKindEnum,
  })
  .strict();

// Eval catalogs use negative ids for promoted historical release observations
// so they cannot be mistaken for real Peated Bottle ids.
const LocalCatalogBottleSchema = z
  .object({
    id: z.number().int(),
    name: z.string().trim().min(1),
    fullName: z.string().trim().min(1).optional(),
    brandId: z.number().int().positive(),
    groupId: z.number().int().positive().nullable().default(null),
    bottlerId: z.number().int().positive().nullable().default(null),
    series: z.string().trim().min(1).nullable().default(null),
    distillerIds: z.array(z.number().int().positive()).default([]),
    category: CategoryEnum.nullable().default(null),
    statedAge: z.number().int().min(0).max(100).nullable().default(null),
    edition: z.string().trim().min(1).nullable().default(null),
    caskStrength: z.boolean().nullable().default(null),
    singleCask: z.boolean().nullable().default(null),
    maturation: z.string().trim().min(1).nullable().default(null),
    caskNumber: z.string().trim().min(1).nullable().default(null),
    outturn: z.number().int().positive().nullable().default(null),
    abv: z.number().min(0).max(100).nullable().default(null),
    vintageYear: z.number().int().gte(1800).nullable().default(null),
    bottlingYear: z.number().int().gte(1800).nullable().optional(),
    releaseYear: z.number().int().gte(1800).nullable().default(null),
  })
  .strict();

const LocalCatalogAliasSchema = z
  .object({
    name: z.string().trim().min(1),
    bottleId: z.number().int(),
    ignored: z.boolean().default(false),
  })
  .strict();

export const LocalCatalogSchema = z
  .object({
    entities: z.array(LocalCatalogEntitySchema).default([]),
    bottles: z.array(LocalCatalogBottleSchema).default([]),
    aliases: z.array(LocalCatalogAliasSchema).default([]),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const entitiesById = new Map(
      catalog.entities.map((entity) => [entity.id, entity]),
    );
    const entityIds = new Set<number>();
    for (const [index, entity] of catalog.entities.entries()) {
      if (entityIds.has(entity.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate entity id ${entity.id}.`,
          path: ["entities", index, "id"],
        });
      }
      entityIds.add(entity.id);
    }

    const bottleIds = new Set<number>();
    for (const [index, bottle] of catalog.bottles.entries()) {
      if (bottleIds.has(bottle.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate bottle id ${bottle.id}.`,
          path: ["bottles", index, "id"],
        });
      }
      bottleIds.add(bottle.id);

      const brand = entitiesById.get(bottle.brandId);
      if (!brand) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown brand id ${bottle.brandId}.`,
          path: ["bottles", index, "brandId"],
        });
      }
      if (bottle.bottlerId !== null) {
        const bottler = entitiesById.get(bottle.bottlerId);
        if (!bottler) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown bottler id ${bottle.bottlerId}.`,
            path: ["bottles", index, "bottlerId"],
          });
        }
      }
      for (const [
        distillerIndex,
        distillerId,
      ] of bottle.distillerIds.entries()) {
        const distiller = entitiesById.get(distillerId);
        if (!distiller) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown distiller id ${distillerId}.`,
            path: ["bottles", index, "distillerIds", distillerIndex],
          });
        }
      }
    }

    for (const [index, alias] of catalog.aliases.entries()) {
      if (!bottleIds.has(alias.bottleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown bottle id ${alias.bottleId}.`,
          path: ["aliases", index, "bottleId"],
        });
      }
    }
  });

export type LocalCatalog = z.infer<typeof LocalCatalogSchema>;
export type LocalCatalogEntity = LocalCatalog["entities"][number];
export type LocalCatalogBottle = LocalCatalog["bottles"][number];
export type LocalCatalogAlias = LocalCatalog["aliases"][number];
