import { mockBottles } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

/** Series come from the mock Bottles that carry them. */
function listMockSeries() {
  const bySeries = new Map<
    number,
    {
      series: NonNullable<(typeof mockBottles)[number]["series"]>;
      brand: (typeof mockBottles)[number]["brand"];
      bottleIds: number[];
    }
  >();
  for (const bottle of mockBottles) {
    if (!bottle.series) continue;
    const entry = bySeries.get(bottle.series.id) ?? {
      series: bottle.series,
      brand: bottle.brand,
      bottleIds: [],
    };
    entry.bottleIds.push(bottle.id);
    bySeries.set(bottle.series.id, entry);
  }
  return [...bySeries.values()];
}

export default mockOS.bottleSeries.list.handler(async ({ input }) => {
  const query = input.query.trim().toLowerCase();
  const matches = listMockSeries()
    .filter(({ series, brand }) => {
      if (input.brand && brand.id !== input.brand) return false;
      if (input.distillery && brand.id !== input.distillery) return false;
      return !query || series.fullName.toLowerCase().includes(query);
    })
    .map(({ series, brand, bottleIds }) => ({
      ...series,
      representativeBottleId: bottleIds[0] ?? null,
      imageUrl: null,
      brand: {
        id: brand.id,
        peatedId: brand.peatedId,
        name: brand.name,
        shortName: brand.shortName,
        kind: brand.kind,
      },
      numBottles: bottleIds.length,
    }))
    .sort((a, b) =>
      input.sort === "-bottles"
        ? b.numBottles - a.numBottles || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  const offset = (input.cursor - 1) * input.limit;
  return {
    results: matches.slice(offset, offset + input.limit),
    total: matches.length,
    rel: {
      nextCursor:
        offset + input.limit < matches.length ? input.cursor + 1 : null,
      prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
    },
  };
});
