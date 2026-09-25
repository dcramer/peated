import type * as FixtureTypes from "@peated/server/lib/test/fixtures";
import { BottleListInputSchema } from "@peated/server/orpc/contracts/bottles/list";
import { routerClient } from "@peated/server/orpc/router";
import { EntitySchema } from "@peated/server/schemas";
import evidence from "./fixtures/search-replays.json";

type RecordedBottle = (typeof evidence.catalog)[number];

// These are response snapshots, not a complete historical catalog. Preserve
// recorded inputs; reviewed decisions are assertions, never extra query facts.
// September 2026 Sentry traces confirm the saved request parameters, not an
// exact response invocation. Rebuild indexes from public identity snapshots;
// historical aliases and popularity are unavailable. Pagination is covered by
// list.test.ts. These cases protect retrieval, not automatic match approval.
async function seedCatalog(
  catalog: RecordedBottle[],
  fixtures: typeof FixtureTypes,
) {
  const entityIds = new Map<number, number>();
  const bottleIds = new Map<number, number>();
  async function entity(record: NonNullable<RecordedBottle["brand"]>) {
    const existing = entityIds.get(record.id);
    if (existing !== undefined) return existing;
    const result = await fixtures.Entity({
      name: record.name,
      shortName: record.shortName,
      kind: EntitySchema.pick({ kind: true }).parse(record).kind,
    });
    entityIds.set(record.id, result.id);
    return result.id;
  }
  async function add(record: RecordedBottle) {
    const brandId = await entity(record.brand);
    const bottle = await fixtures.Bottle({
      name: record.name,
      brandId,
      bottlerId: record.bottler ? await entity(record.bottler) : null,
      distillerIds: await Promise.all(record.distillers.map(entity)),
      edition: record.edition,
      statedAge: record.statedAge,
      abv: record.abv,
      vintageYear: record.vintageYear,
      bottlingYear: record.bottlingYear,
      releaseYear: record.releaseYear,
      caskNumber: record.caskNumber,
      createdAt: new Date(record.createdAt),
    });
    bottleIds.set(record.id, bottle.id);
    return bottle;
  }
  // Keep creation order stable for the route's ID tie-breaker.
  for (const record of [...catalog].sort((a, b) => a.id - b.id)) {
    await add(record);
  }
  return { bottleIds, add };
}

for (const replay of evidence.cases) {
  test(`replays ${replay.name}`, async ({ fixtures }) => {
    const { bottleIds, add } = await seedCatalog(
      evidence.catalog.filter((b) => replay.catalogIds.includes(b.id)),
      fixtures,
    );
    const pages = [];
    for (const request of replay.requests) {
      const params = new URLSearchParams(request.path.split("?")[1]);
      const input = BottleListInputSchema.parse(Object.fromEntries(params));
      pages.push(await routerClient.bottles.list(input));
    }
    const ids = pages.flatMap((page) => page.results.map((b) => b.id));

    if (replay.kind === "missing") {
      expect(ids).toEqual([]);
      expect(pages[0].total).toBe(0);
      const later = replay.laterBottle!;
      expect(bottleIds.has(later.id)).toBe(false);
      expect(new Date(later.createdAt).getTime()).toBeGreaterThan(
        new Date(replay.requests[0].traces[0].timestamp).getTime(),
      );
      const created = await add(later);
      const input = BottleListInputSchema.parse(
        Object.fromEntries(
          new URLSearchParams(replay.requests[0].path.split("?")[1]),
        ),
      );
      const after = await routerClient.bottles.list(input);
      expect(after.results.map((b) => b.id)).toContain(created.id);
      return;
    }

    // A broad search must retain alternatives, including the holiday release
    // rejected during the Leopold review. Retrieval does not approve identity.
    const expectedIds = replay.requests.flatMap((request) =>
      request.observedBottleIds.map((id) => bottleIds.get(id)),
    );
    expect(new Set(ids)).toEqual(new Set(expectedIds));
    expect(ids.length).toBe(expectedIds.length);
    expect(pages[0].total).toBe(expectedIds.length);
    if (replay.expectedBottleId !== null) {
      expect(replay.decision?.verified).toBe(true);
      expect(ids).toContain(bottleIds.get(replay.expectedBottleId));
    }
  });
}
