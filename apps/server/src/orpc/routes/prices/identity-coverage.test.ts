import { db } from "@peated/server/db";
import { storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /external-sites/:site/prices/identity-coverage", () => {
  test("requires authentication", async () => {
    const error = await waitError(() =>
      routerClient.prices.identityCoverage({ site: "totalwine" }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires admin", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.prices.identityCoverage(
        { site: "totalwine" },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns not found for an unconfigured site", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    const error = await waitError(() =>
      routerClient.prices.identityCoverage(
        { site: "totalwine" },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Site not found.]`);
  });

  test("counts visible identity coverage for only the requested site", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const otherSite = await fixtures.ExternalSiteOrExisting({
      type: "healthyspirits",
    });
    const bottle = await fixtures.Bottle({ name: "Coverage Bottle" });

    await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: bottle.id,
      externalProductId: "matched-source-id",
      sourceFingerprint: "matched-fingerprint",
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      externalProductId: "unmatched-source-id",
      sourceFingerprint: null,
    });
    const unresolved = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      externalProductId: null,
      sourceFingerprint: "url-fallback-fingerprint",
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: bottle.id,
      externalProductId: "hidden-source-id",
      sourceFingerprint: "hidden-fingerprint",
      hidden: true,
    });
    await fixtures.StorePrice({
      externalSiteId: otherSite.id,
      bottleId: bottle.id,
      externalProductId: "other-site-source-id",
      sourceFingerprint: "other-site-fingerprint",
    });

    await expect(
      routerClient.prices.identityCoverage(
        { site: site.type },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      total: 3,
      matched: 1,
      unmatched: 2,
      withSourceId: 2,
      withFingerprint: 2,
    });

    await db
      .update(storePrices)
      .set({ bottleId: bottle.id, externalProductId: "resolved-source-id" })
      .where(eq(storePrices.id, unresolved.id));

    await expect(
      routerClient.prices.identityCoverage(
        { site: site.type },
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      total: 3,
      matched: 2,
      unmatched: 1,
      withSourceId: 3,
      withFingerprint: 2,
    });
  });
});
