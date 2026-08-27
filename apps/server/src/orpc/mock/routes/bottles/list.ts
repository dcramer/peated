import { BOTTLE_AGE_BAND_LIST, CATEGORY_LIST } from "@peated/server/constants";
import {
  includesQuery,
  mockBottleFor,
  mockBottles,
  mockFlightBottleIds,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

type MockBottle = (typeof mockBottles)[number];
type BottleAgeBand = (typeof BOTTLE_AGE_BAND_LIST)[number];

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

    const flightBottleIds = input.flight
      ? mockFlightBottleIds.get(input.flight)
      : undefined;
    const matchesBottle = (
      bottle: MockBottle,
      omittedFacet?: "category" | "ageBand",
    ) =>
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
      (input.entity == null ||
        bottle.brand.id === input.entity ||
        bottle.bottler?.id === input.entity ||
        bottle.distillers.some((entity) => entity.id === input.entity)) &&
      (input.series == null || bottle.series?.id === input.series) &&
      (input.tag == null || bottle.suggestedTags?.includes(input.tag)) &&
      (input.flavorProfile == null ||
        bottle.flavorProfile === input.flavorProfile) &&
      (omittedFacet === "category" ||
        input.category == null ||
        bottle.category === input.category) &&
      (input.age == null || bottle.statedAge === input.age) &&
      (omittedFacet === "ageBand" ||
        input.ageBand == null ||
        matchesAgeBand(bottle, input.ageBand)) &&
      (input.minScore == null || (bottle.medianScore ?? 0) >= input.minScore) &&
      (input.flight == null || flightBottleIds?.includes(bottle.id) === true) &&
      (input.filter !== "following" ||
        bottle.brand.id === 9201 ||
        bottle.brand.id === 9202);

    let bottles = mockBottles.filter((bottle) => matchesBottle(bottle));
    const total = bottles.length;
    const facets = {
      category: CATEGORY_LIST.flatMap((value) => {
        const count = mockBottles.filter(
          (bottle) =>
            matchesBottle(bottle, "category") && bottle.category === value,
        ).length;
        return count > 0 ? [{ value, count }] : [];
      }),
      ageBand: BOTTLE_AGE_BAND_LIST.flatMap((value) => {
        const count = mockBottles.filter(
          (bottle) =>
            matchesBottle(bottle, "ageBand") && matchesAgeBand(bottle, value),
        ).length;
        return count > 0 ? [{ value, count }] : [];
      }),
    };

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
      facets,
      followedDistillerCount: input.filter === "following" ? 2 : null,
    };
  },
);
