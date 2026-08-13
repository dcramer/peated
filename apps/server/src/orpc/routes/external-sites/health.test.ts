import { db } from "@peated/server/db";
import { externalSiteRuns, storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

test("health list requires an administrator", async () => {
  const error = await waitError(() =>
    routerClient.externalSites.healthList({}),
  );
  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
});

test("health list distinguishes listings from latest execution", async ({
  fixtures,
}) => {
  const admin = await fixtures.User({ admin: true });
  const site = await fixtures.ExternalSite({
    type: "decadentdrinks",
    lastRunAt: new Date("2026-08-12T10:00:00.000Z"),
  });
  const visiblePrice = await fixtures.StorePrice({ externalSiteId: site.id });
  await db
    .update(storePrices)
    .set({ hidden: false })
    .where(eq(storePrices.id, visiblePrice.id));
  const completedAt = new Date("2026-08-12T12:00:00.000Z");
  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      status: "failed",
      trigger: "manual",
      requestedById: admin.id,
      attemptCount: 1,
      error: "Unexpected scraper failure. See Sentry for this run.",
      startedAt: new Date("2026-08-12T11:59:00.000Z"),
      completedAt,
    })
    .returning();

  const result = await routerClient.externalSites.healthList(
    {},
    { context: { user: admin } },
  );

  expect(result.results).toHaveLength(1);
  expect(result.results[0]).toMatchObject({
    type: "decadentdrinks",
    listingCount: 1,
    lastRunAt: null,
    latestRun: {
      id: run?.id,
      status: "failed",
      trigger: "manual",
    },
    lastSucceededAt: null,
  });
});

test("run history is administrator-only", async ({ fixtures }) => {
  const site = await fixtures.ExternalSite({ type: "decadentdrinks" });
  const error = await waitError(() =>
    routerClient.externalSites.runs({ site: site.type }),
  );
  expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
});
