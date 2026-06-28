import { z } from "zod";
import {
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
  EntityTypeEnum,
} from "../classifierTypes";

const LocalCatalogEntitySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1),
    shortName: z.string().trim().min(1).nullable().default(null),
    type: z.array(EntityTypeEnum).min(1),
  })
  .strict();

const LocalCatalogBottleSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1),
    fullName: z.string().trim().min(1).optional(),
    brandId: z.number().int().positive(),
    bottlerId: z.number().int().positive().nullable().default(null),
    series: z.string().trim().min(1).nullable().default(null),
    distillerIds: z.array(z.number().int().positive()).default([]),
    category: CategoryEnum.nullable().default(null),
    statedAge: z.number().int().min(0).max(100).nullable().default(null),
    edition: z.string().trim().min(1).nullable().default(null),
    caskStrength: z.boolean().nullable().default(null),
    singleCask: z.boolean().nullable().default(null),
    abv: z.number().min(0).max(100).nullable().default(null),
    vintageYear: z.number().int().gte(1800).nullable().default(null),
    releaseYear: z.number().int().gte(1800).nullable().default(null),
    caskType: CaskTypeEnum.nullable().default(null),
    caskSize: CaskSizeEnum.nullable().default(null),
    caskFill: CaskFillEnum.nullable().default(null),
  })
  .strict();

const LocalCatalogReleaseSchema = z
  .object({
    id: z.number().int().positive(),
    bottleId: z.number().int().positive(),
    fullName: z.string().trim().min(1).optional(),
    edition: z.string().trim().min(1).nullable().default(null),
    statedAge: z.number().int().min(0).max(100).nullable().default(null),
    caskStrength: z.boolean().nullable().default(null),
    singleCask: z.boolean().nullable().default(null),
    abv: z.number().min(0).max(100).nullable().default(null),
    vintageYear: z.number().int().gte(1800).nullable().default(null),
    releaseYear: z.number().int().gte(1800).nullable().default(null),
    caskType: CaskTypeEnum.nullable().default(null),
    caskSize: CaskSizeEnum.nullable().default(null),
    caskFill: CaskFillEnum.nullable().default(null),
  })
  .strict();

const LocalCatalogAliasSchema = z
  .object({
    name: z.string().trim().min(1),
    bottleId: z.number().int().positive(),
    releaseId: z.number().int().positive().nullable().default(null),
    ignored: z.boolean().default(false),
  })
  .strict();

export const LocalCatalogSchema = z
  .object({
    entities: z.array(LocalCatalogEntitySchema).default([]),
    bottles: z.array(LocalCatalogBottleSchema).default([]),
    releases: z.array(LocalCatalogReleaseSchema).default([]),
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
      } else if (!brand.type.includes("brand")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Entity ${bottle.brandId} is not a brand.`,
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
        } else if (!bottler.type.includes("bottler")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Entity ${bottle.bottlerId} is not a bottler.`,
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
        } else if (!distiller.type.includes("distiller")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Entity ${distillerId} is not a distiller.`,
            path: ["bottles", index, "distillerIds", distillerIndex],
          });
        }
      }
    }

    const releaseIds = new Set<number>();
    const releasesById = new Map<number, LocalCatalogRelease>();
    for (const [index, release] of catalog.releases.entries()) {
      if (releaseIds.has(release.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate release id ${release.id}.`,
          path: ["releases", index, "id"],
        });
      }
      releaseIds.add(release.id);
      releasesById.set(release.id, release);

      if (!bottleIds.has(release.bottleId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown bottle id ${release.bottleId}.`,
          path: ["releases", index, "bottleId"],
        });
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
      if (alias.releaseId !== null) {
        const release = releasesById.get(alias.releaseId);
        if (!release) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown release id ${alias.releaseId}.`,
            path: ["aliases", index, "releaseId"],
          });
        } else if (release.bottleId !== alias.bottleId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Release ${alias.releaseId} does not belong to bottle ${alias.bottleId}.`,
            path: ["aliases", index, "releaseId"],
          });
        }
      }
    }
  });

export type LocalCatalog = z.infer<typeof LocalCatalogSchema>;
export type LocalCatalogEntity = LocalCatalog["entities"][number];
export type LocalCatalogBottle = LocalCatalog["bottles"][number];
export type LocalCatalogRelease = LocalCatalog["releases"][number];
export type LocalCatalogAlias = LocalCatalog["aliases"][number];
