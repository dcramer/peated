import type { BOTTLE_AGE_BAND_LIST } from "@peated/server/constants";
import {
  includesQuery,
  mockBottleFor,
  mockBottles,
  mockEntities,
  mockFlightBottleIds,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

type MockBottle = (typeof mockBottles)[number];
type BottleAgeBand = (typeof BOTTLE_AGE_BAND_LIST)[number];

function isInCompanyBottleScope(entityId: number, companyId: number) {
  let entity = mockEntities.find(({ id }) => id === entityId);

  const visited = new Set<number>();
  while (entity && !visited.has(entity.id)) {
    if (entity.id === companyId) return true;
    visited.add(entity.id);
    entity = mockEntities.find(({ id }) => id === entity?.ownerId);
  }
  return false;
}

function matchesDistilleryView(
  bottle: MockBottle,
  entityId: number,
  view: "releases" | "other",
) {
  const ownBrand =
    bottle.brand.id === entityId || bottle.brand.ownerId === entityId;
  const ownBottler =
    bottle.bottler === null ||
    bottle.bottler.id === entityId ||
    bottle.bottler.ownerId === entityId;
  const madeByDistillery = bottle.distillers.some(
    (distiller) => distiller.id === entityId,
  );
  const ownRelease = ownBrand && ownBottler;

  return view === "releases"
    ? ownRelease
    : (ownBrand || madeByDistillery) && !ownRelease;
}

function matchesAgeBand(bottle: MockBottle, ageBand: BottleAgeBand) {
  switch (ageBand) {
    case "nas":
      return bottle.noAgeStatement === true;
    case "under_12":
      return bottle.statedAge !== null && bottle.statedAge < 12;
    case "12_17":
      return (
        bottle.statedAge !== null &&
        bottle.statedAge >= 12 &&
        bottle.statedAge < 18
      );
    case "18_24":
      return (
        bottle.statedAge !== null &&
        bottle.statedAge >= 18 &&
        bottle.statedAge < 25
      );
    case "25_plus":
      return bottle.statedAge !== null && bottle.statedAge >= 25;
  }
}

export default mockOS.bottles.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "following" && !context.user) {
      throw errors.UNAUTHORIZED();
    }
    if (input.company != null && input.entity != null) {
      throw errors.BAD_REQUEST({
        message: "Choose either a Company or an Entity.",
      });
    }
    if (
      input.company != null &&
      mockEntities.find(({ id }) => id === input.company)?.kind !== "company"
    ) {
      throw errors.BAD_REQUEST({ message: "Choose a Company." });
    }

    const flightBottleIds = input.flight
      ? mockFlightBottleIds.get(input.flight)
      : undefined;
    const matchesBottle = (bottle: MockBottle) =>
      includesQuery(
        input.query,
        bottle.fullName,
        bottle.name,
        bottle.brand.name,
      ) &&
      (input.brand == null || bottle.brand.id === input.brand) &&
      (input.distiller == null ||
        bottle.distillers.some((entity) => entity.id === input.distiller)) &&
      (input.bottler == null || bottle.bottler?.id === input.bottler) &&
      (input.company == null ||
        isInCompanyBottleScope(bottle.brand.id, input.company) ||
        (bottle.bottler !== null &&
          isInCompanyBottleScope(bottle.bottler.id, input.company)) ||
        bottle.distillers.some((entity) =>
          isInCompanyBottleScope(entity.id, input.company!),
        )) &&
      (input.entity == null ||
        (input.distilleryView
          ? matchesDistilleryView(bottle, input.entity, input.distilleryView)
          : bottle.brand.id === input.entity ||
            bottle.bottler?.id === input.entity ||
            bottle.distillers.some((entity) => entity.id === input.entity))) &&
      (input.series == null || bottle.series?.id === input.series) &&
      (input.tag == null || bottle.suggestedTags?.includes(input.tag)) &&
      (input.flavorProfile == null ||
        bottle.flavorProfile === input.flavorProfile) &&
      (input.category == null || bottle.category === input.category) &&
      (input.age == null || bottle.statedAge === input.age) &&
      (input.ageBand == null || matchesAgeBand(bottle, input.ageBand)) &&
      (input.minScore == null || (bottle.medianScore ?? 0) >= input.minScore) &&
      (input.flight == null || flightBottleIds?.includes(bottle.id) === true) &&
      (input.filter !== "following" ||
        bottle.brand.id === 9201 ||
        bottle.brand.id === 9202);

    let bottles = mockBottles.filter((bottle) => matchesBottle(bottle));
    const total = bottles.length;

    const direction = input.sort.startsWith("-") ? -1 : 1;
    const sort = input.sort.replace(/^-/, "");
    bottles = bottles.toSorted((left, right) => {
      switch (sort) {
        case "name":
          return direction * left.fullName.localeCompare(right.fullName);
        case "brand":
          return direction * left.brand.name.localeCompare(right.brand.name);
        case "age":
          return direction * ((left.statedAge ?? 0) - (right.statedAge ?? 0));
        case "score":
          return (
            direction * ((left.medianScore ?? 0) - (right.medianScore ?? 0))
          );
        case "tastings":
          return direction * (left.totalTastings - right.totalTastings);
        case "rank":
          return 0;
        case "created":
        case "release":
          return direction * left.createdAt.localeCompare(right.createdAt);
        default:
          return 0;
      }
    });

    return {
      ...mockPage(
        bottles.map((bottle) => mockBottleFor(context.user, bottle)),
        input.cursor,
        input.limit,
      ),
      total,
      followedEntityCount: input.filter === "following" ? 3 : null,
    };
  },
);
