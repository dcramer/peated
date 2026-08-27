import type { MockOutputs } from "../contract";
import { mockBottle, mockBottles } from "./bottles";
import { mockEntity } from "./entities";

type Bottle = MockOutputs["bottles"]["list"]["results"][number];
type Entity = MockOutputs["entities"]["details"];

export const mockEntityCatalog = {
  totalBottles: mockEntity.totalBottles,
  relationships: {
    brand: mockEntity.totalBottles,
    bottler: 0,
    distiller: mockEntity.totalBottles,
  },
  distilleryCoverage: {
    documented: mockEntity.totalBottles,
    total: mockEntity.totalBottles,
  },
  categories: [{ category: "single_malt", count: mockEntity.totalBottles }],
  related: {
    brands: [],
    bottlers: [],
    distillers: [],
  },
  notableBottles: [
    {
      id: mockBottle.id,
      fullName: mockBottle.fullName,
      totalTastings: mockBottle.totalTastings,
      medianScore: mockBottle.medianScore,
    },
  ],
} satisfies MockOutputs["entities"]["catalog"];

export function mockEntityCatalogFor(
  entity: Entity,
): MockOutputs["entities"]["catalog"] {
  if (entity.id === mockEntity.id) {
    const lagavulinBottles = mockBottles.filter(
      (bottle) => bottle.brand.id === entity.id,
    );
    return {
      ...mockEntityCatalog,
      notableBottles: lagavulinBottles.map((bottle) => ({
        id: bottle.id,
        fullName: bottle.fullName,
        totalTastings: bottle.totalTastings,
        medianScore: bottle.medianScore,
      })),
    };
  }

  const relatedBottles = mockBottles.filter(
    (bottle) =>
      bottle.brand.id === entity.id ||
      bottle.bottler?.id === entity.id ||
      bottle.distillers.some((distiller) => distiller.id === entity.id),
  );
  const categoryCounts = new Map<Bottle["category"], number>();
  for (const bottle of relatedBottles) {
    categoryCounts.set(
      bottle.category,
      (categoryCounts.get(bottle.category) ?? 0) + 1,
    );
  }
  const relatedEntities = (
    values: Entity[],
  ): MockOutputs["entities"]["catalog"]["related"]["brands"] =>
    values
      .filter(
        (value, index) =>
          value.id !== entity.id &&
          values.findIndex((candidate) => candidate.id === value.id) === index,
      )
      .map((value) => ({
        id: value.id,
        name: value.name,
        shortName: value.shortName,
        kind: value.kind,
        count: relatedBottles.filter(
          (bottle) =>
            bottle.brand.id === value.id ||
            bottle.bottler?.id === value.id ||
            bottle.distillers.some((distiller) => distiller.id === value.id),
        ).length,
      }));

  return {
    totalBottles: entity.totalBottles,
    relationships: {
      brand: relatedBottles.filter((bottle) => bottle.brand.id === entity.id)
        .length,
      bottler: relatedBottles.filter(
        (bottle) => bottle.bottler?.id === entity.id,
      ).length,
      distiller: relatedBottles.filter((bottle) =>
        bottle.distillers.some((distiller) => distiller.id === entity.id),
      ).length,
    },
    distilleryCoverage: {
      documented: relatedBottles.some((bottle) =>
        bottle.distillers.some((distiller) => distiller.id === entity.id),
      )
        ? entity.totalBottles
        : 0,
      total: entity.totalBottles,
    },
    categories: [...categoryCounts].map(([category, count]) => ({
      category,
      count: Math.round(
        entity.totalBottles * (count / Math.max(relatedBottles.length, 1)),
      ),
    })),
    related: {
      brands: relatedEntities(relatedBottles.map((bottle) => bottle.brand)),
      bottlers: relatedEntities(
        relatedBottles.flatMap((bottle) =>
          bottle.bottler ? [bottle.bottler] : [],
        ),
      ),
      distillers: relatedEntities(
        relatedBottles.flatMap((bottle) => bottle.distillers),
      ),
    },
    notableBottles: relatedBottles.map((bottle) => ({
      id: bottle.id,
      fullName: bottle.fullName,
      totalTastings: bottle.totalTastings,
      medianScore: bottle.medianScore,
    })),
  };
}
