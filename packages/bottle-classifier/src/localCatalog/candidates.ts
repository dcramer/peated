import {
  BOTTLE_EXACT_TRAIT_FIELDS,
  BottleCandidateSchema,
  type BottleCandidate,
} from "../classifierTypes";
import type { LocalCatalog, LocalCatalogBottle } from "./schema";

type CatalogIndexes = {
  entitiesById: Map<number, LocalCatalog["entities"][number]>;
};

type CandidateSource = "exact" | "text" | "brand" | "vector" | "current";

function createCatalogIndexes(catalog: LocalCatalog): CatalogIndexes {
  return {
    entitiesById: new Map(
      catalog.entities.map((entity) => [entity.id, entity]),
    ),
  };
}

function getEntityName(indexes: CatalogIndexes, id: number | null) {
  return id === null ? null : (indexes.entitiesById.get(id)?.name ?? null);
}

function getBottleFullName(
  indexes: CatalogIndexes,
  bottle: LocalCatalogBottle,
) {
  return (
    bottle.fullName ??
    [getEntityName(indexes, bottle.brandId), bottle.name]
      .filter(Boolean)
      .join(" ")
      .trim()
  );
}

function getTraitFields(value: Partial<LocalCatalogBottle>) {
  return BOTTLE_EXACT_TRAIT_FIELDS.filter((field) => value[field] != null);
}

function getSiblingBottleContext({
  catalog,
  indexes,
  bottle,
}: {
  catalog: LocalCatalog;
  indexes: CatalogIndexes;
  bottle: LocalCatalogBottle;
}): NonNullable<BottleCandidate["familyContext"]>["siblingBottles"] {
  if (bottle.groupId === null) {
    return [];
  }

  return catalog.bottles
    .filter(
      (sibling) =>
        sibling.id !== bottle.id &&
        sibling.groupId !== null &&
        sibling.groupId === bottle.groupId,
    )
    .map((sibling) => ({
      bottleId: sibling.id,
      fullName: getBottleFullName(indexes, sibling),
      traitFields: getTraitFields(sibling),
      statedAge: sibling.statedAge,
      edition: sibling.edition,
      releaseYear: sibling.releaseYear,
      vintageYear: sibling.vintageYear,
      abv: sibling.abv,
      singleCask: sibling.singleCask,
      caskStrength: sibling.caskStrength,
      caskType: sibling.caskType,
      caskSize: sibling.caskSize,
      caskFill: sibling.caskFill,
    }));
}

export function buildBottleCandidateFromCatalog({
  catalog,
  bottle,
  alias = null,
  score = null,
  source,
}: {
  catalog: LocalCatalog;
  bottle: LocalCatalogBottle;
  alias?: string | null;
  score?: number | null;
  source: CandidateSource[];
}): BottleCandidate {
  const indexes = createCatalogIndexes(catalog);
  const bottleFullName = getBottleFullName(indexes, bottle);

  return BottleCandidateSchema.parse({
    bottleId: bottle.id,
    alias,
    fullName: bottleFullName,
    brand: getEntityName(indexes, bottle.brandId),
    bottler: getEntityName(indexes, bottle.bottlerId),
    series: bottle.series,
    distillery: bottle.distillerIds.flatMap((id) => {
      const name = getEntityName(indexes, id);
      return name ? [name] : [];
    }),
    category: bottle.category,
    statedAge: bottle.statedAge,
    edition: bottle.edition,
    caskStrength: bottle.caskStrength,
    caskType: bottle.caskType,
    caskSize: bottle.caskSize,
    caskFill: bottle.caskFill,
    singleCask: bottle.singleCask,
    abv: bottle.abv,
    vintageYear: bottle.vintageYear,
    releaseYear: bottle.releaseYear,
    score,
    source,
    familyContext: {
      siblingBottles: getSiblingBottleContext({ catalog, indexes, bottle }),
    },
  });
}
