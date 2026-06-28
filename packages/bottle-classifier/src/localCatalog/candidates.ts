import {
  BOTTLE_RELEASE_TRAIT_FIELDS,
  BottleCandidateSchema,
  type BottleCandidate,
} from "../classifierTypes";
import type {
  LocalCatalog,
  LocalCatalogBottle,
  LocalCatalogRelease,
} from "./schema";

type CatalogIndexes = {
  entitiesById: Map<number, LocalCatalog["entities"][number]>;
  bottlesById: Map<number, LocalCatalogBottle>;
  releasesByBottleId: Map<number, LocalCatalogRelease[]>;
};

type CandidateSource = "exact" | "text" | "brand" | "vector" | "current";

function createCatalogIndexes(catalog: LocalCatalog): CatalogIndexes {
  const releasesByBottleId = new Map<number, LocalCatalogRelease[]>();
  for (const release of catalog.releases) {
    releasesByBottleId.set(release.bottleId, [
      ...(releasesByBottleId.get(release.bottleId) ?? []),
      release,
    ]);
  }

  return {
    entitiesById: new Map(
      catalog.entities.map((entity) => [entity.id, entity]),
    ),
    bottlesById: new Map(catalog.bottles.map((bottle) => [bottle.id, bottle])),
    releasesByBottleId,
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

function getReleaseFullName({
  bottleFullName,
  release,
}: {
  bottleFullName: string;
  release: LocalCatalogRelease;
}) {
  return (
    release.fullName ??
    [bottleFullName, release.edition, release.releaseYear, release.vintageYear]
      .filter(Boolean)
      .join(" ")
      .trim()
  );
}

function comparableIdentity(value: string) {
  // Ignore age only for same-family sibling grouping; age still remains
  // candidate identity and is surfaced in candidate fields.
  return value
    .toLowerCase()
    .replace(/\b\d{1,3}\s*[- ]?\s*years?\s*[- ]?\s*old\b/g, "")
    .replace(/\b\d{1,3}\s*yo\b/g, "")
    .replace(/\b\d{1,3}\s*yr\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && token !== "the")
    .join(" ");
}

function getTraitFields(
  value: Partial<LocalCatalogBottle | LocalCatalogRelease>,
) {
  return BOTTLE_RELEASE_TRAIT_FIELDS.filter((field) => value[field] != null);
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
  const bottleIdentity = comparableIdentity(bottle.name);

  return catalog.bottles
    .filter(
      (sibling) =>
        sibling.id !== bottle.id &&
        sibling.brandId === bottle.brandId &&
        comparableIdentity(sibling.name) === bottleIdentity,
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
      caskFill: sibling.caskFill,
      caskType: sibling.caskType,
      caskSize: sibling.caskSize,
    }));
}

function getSiblingReleaseContext({
  indexes,
  bottle,
}: {
  indexes: CatalogIndexes;
  bottle: LocalCatalogBottle;
}): NonNullable<BottleCandidate["familyContext"]>["siblingReleases"] {
  const bottleFullName = getBottleFullName(indexes, bottle);

  return (indexes.releasesByBottleId.get(bottle.id) ?? []).map((release) => ({
    releaseId: release.id,
    fullName: getReleaseFullName({ bottleFullName, release }),
    traitFields: getTraitFields(release),
    edition: release.edition,
    statedAge: release.statedAge,
    releaseYear: release.releaseYear,
    vintageYear: release.vintageYear,
    abv: release.abv,
    singleCask: release.singleCask,
    caskStrength: release.caskStrength,
    caskFill: release.caskFill,
    caskType: release.caskType,
    caskSize: release.caskSize,
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
    kind: "bottle",
    bottleId: bottle.id,
    releaseId: null,
    alias,
    fullName: bottleFullName,
    bottleFullName,
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
    singleCask: bottle.singleCask,
    abv: bottle.abv,
    vintageYear: bottle.vintageYear,
    releaseYear: bottle.releaseYear,
    caskType: bottle.caskType,
    caskSize: bottle.caskSize,
    caskFill: bottle.caskFill,
    score,
    source,
    familyContext: {
      parentBottleReleaseTraits: getTraitFields(bottle),
      childReleaseCount: indexes.releasesByBottleId.get(bottle.id)?.length ?? 0,
      siblingReleases: getSiblingReleaseContext({ indexes, bottle }),
      siblingBottles: getSiblingBottleContext({ catalog, indexes, bottle }),
    },
  });
}

export function buildReleaseCandidateFromCatalog({
  catalog,
  bottle,
  release,
  alias = null,
  score = null,
  source,
}: {
  catalog: LocalCatalog;
  bottle: LocalCatalogBottle;
  release: LocalCatalogRelease;
  alias?: string | null;
  score?: number | null;
  source: CandidateSource[];
}): BottleCandidate {
  const indexes = createCatalogIndexes(catalog);
  const bottleFullName = getBottleFullName(indexes, bottle);

  return BottleCandidateSchema.parse({
    kind: "release",
    bottleId: bottle.id,
    releaseId: release.id,
    alias,
    fullName: getReleaseFullName({ bottleFullName, release }),
    bottleFullName,
    brand: getEntityName(indexes, bottle.brandId),
    bottler: getEntityName(indexes, bottle.bottlerId),
    series: bottle.series,
    distillery: bottle.distillerIds.flatMap((id) => {
      const name = getEntityName(indexes, id);
      return name ? [name] : [];
    }),
    category: bottle.category,
    statedAge: release.statedAge ?? bottle.statedAge,
    edition: release.edition ?? bottle.edition,
    caskStrength: release.caskStrength ?? bottle.caskStrength,
    singleCask: release.singleCask ?? bottle.singleCask,
    abv: release.abv ?? bottle.abv,
    vintageYear: release.vintageYear ?? bottle.vintageYear,
    releaseYear: release.releaseYear ?? bottle.releaseYear,
    caskType: release.caskType ?? bottle.caskType,
    caskSize: release.caskSize ?? bottle.caskSize,
    caskFill: release.caskFill ?? bottle.caskFill,
    score,
    source,
    familyContext: {
      parentBottleReleaseTraits: getTraitFields(bottle),
      childReleaseCount: indexes.releasesByBottleId.get(bottle.id)?.length ?? 0,
      siblingReleases: getSiblingReleaseContext({ indexes, bottle }),
      siblingBottles: getSiblingBottleContext({ catalog, indexes, bottle }),
    },
  });
}
