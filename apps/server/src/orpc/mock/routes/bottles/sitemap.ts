import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

const PAGE_LIMIT = 1000;

export default mockOS.bottles.sitemap.handler(async ({ input }) => ({
  results: mockBottles
    .toSorted((left, right) => left.id - right.id)
    .slice((input.page - 1) * PAGE_LIMIT, input.page * PAGE_LIMIT)
    .map((bottle) => ({
      id: bottle.id,
      name: bottle.name,
      edition: bottle.edition,
      statedAge: bottle.statedAge,
      vintageYear: bottle.vintageYear,
      releaseYear: bottle.releaseYear,
      abv: bottle.abv,
      singleCask: bottle.singleCask,
      caskStrength: bottle.caskStrength,
      brand: { name: bottle.brand.name, shortName: bottle.brand.shortName },
      series: bottle.series ? { name: bottle.series.name } : null,
      group: bottle.group ? { name: bottle.group.name } : null,
      updatedAt: bottle.updatedAt,
    })),
}));
