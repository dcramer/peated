import { db } from "@peated/server/db";
import { externalSites, storePrices } from "@peated/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCaller } from "../router";

describe("priceList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("lists prices with default parameters", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });
    const site = await fixtures.ExternalSiteOrExisting();
    const price1 = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Price 1",
    });
    const price2 = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Price 2",
    });

    const result = await caller.priceList({});

    expect(result.results.length).toBe(2);
    expect(result.results[0].id).toBe(price1.id);
    expect(result.results[1].id).toBe(price2.id);
    expect(result.rel.nextCursor).toBeNull();
    expect(result.rel.prevCursor).toBeNull();
  });

  test("filters prices by site", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });
    const site1 = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const price1 = await fixtures.StorePrice({ externalSiteId: site1.id });
    const site2 = await fixtures.ExternalSiteOrExisting({
      type: "healthyspirits",
    });
    await fixtures.StorePrice({ externalSiteId: site2.id }); // Different site

    const result = await caller.priceList({ site: "whiskyadvocate" });

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(price1.id);
  });

  test("filters unknown prices", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    const price1 = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
    });
    await fixtures.StorePrice({ bottleId: bottle.id, externalSiteId: site.id }); // Known bottle

    const result = await caller.priceList({ onlyUnknown: true });

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(price1.id);
  });

  test("filters prices by query", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });
    const site = await fixtures.ExternalSiteOrExisting();
    const price1 = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Unique Whiskey",
    });
    await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Common Bourbon",
    });

    const result = await caller.priceList({ query: "Unique" });

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(price1.id);
  });

  test("throws NOT_FOUND for non-existent site", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });

    await expect(
      caller.priceList({ site: "nonexistent" as any }),
    ).rejects.toThrow(TRPCError);
  });

  test("requires admin permission", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: false });
    const caller = createCaller({ user });

    await expect(caller.priceList({})).rejects.toThrow(TRPCError);
  });

  test("excludes hidden prices", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });
    const site = await fixtures.ExternalSiteOrExisting();
    await fixtures.StorePrice({ hidden: true, externalSiteId: site.id });
    const visiblePrice = await fixtures.StorePrice({
      hidden: false,
      externalSiteId: site.id,
    });

    const result = await caller.priceList({});

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(visiblePrice.id);
  });

  test("includes prices older than a week by default", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await caller.priceList({});

    expect(result.results.length).toBe(2);
    expect(result.results.map((p) => p.id)).toContain(recentPrice.id);
    expect(result.results.map((p) => p.id)).toContain(oldPrice.id);
  });

  test("excludes prices older than a week when onlyValid is true", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const caller = createCaller({ user: admin });
    const recentPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "astorwines",
        })
      ).id,
    });
    const oldPrice = await fixtures.StorePrice({
      externalSiteId: (
        await fixtures.ExternalSiteOrExisting({
          type: "totalwine",
        })
      ).id,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });

    const result = await caller.priceList({ onlyValid: true });

    expect(result.results.length).toBe(1);
    expect(result.results[0].id).toBe(recentPrice.id);
  });
});
