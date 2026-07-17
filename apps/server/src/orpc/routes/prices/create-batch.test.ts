import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleAliases,
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
  reviews,
  storePriceHistories,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function getExactTargetId(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Exact target fixture not found.");
  return target.id;
}

async function getGenericTargetId(groupId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error("Generic target fixture not found.");
  return target.id;
}

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<number> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await client.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))`,
      [blockerPid],
    );
    const pid = result.rows[0]?.pid;
    if (pid) return pid;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for StorePrice ingestion target lock.");
}

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

describe("POST /external-sites/:site/prices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.prices.createBatch({ site: "healthyspirits", prices: [] }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "healthyspirits", prices: [] },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns error for non-existent site", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.prices.createBatch(
        { site: "non-existent-site" as any, prices: [] },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("processes new price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    expect(bottle.fullName).toBe("Ardbeg 10-year-old");

    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old",
            price: 9999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
            imageUrl: "http://example.com/foo.jpg",
          },
        ],
      },
      { context: { user } },
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));
    expect(prices.length).toBe(1);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].price).toBe(9999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(prices[0].url).toBe("http://example.com");
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "Ardbeg 10-year-old"),
    });
    expect(alias).toMatchObject({
      bottleId: bottle.id,
      targetId: expect.any(Number),
      assignmentSource: "source_approved",
    });
    expect(prices[0].targetId).toBe(alias?.targetId);
    expect(workerClient.pushJob).toHaveBeenCalledWith("CapturePriceImage", {
      priceId: prices[0].id,
      imageUrl: "http://example.com/foo.jpg",
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("persists a generic alias target without choosing a representative", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const staleBottle = await fixtures.Bottle();
    const staleRelease = await fixtures.BottleRelease({
      bottleId: staleBottle.id,
    });
    const staleTargetId = await getExactTargetId(staleBottle.id);
    const genericTargetId = await getGenericTargetId(bottle.groupId!);
    const user = await fixtures.User({ admin: true });
    await db.insert(bottleAliases).values({
      name: "Stable Expression Alias",
      bottleId: null,
      releaseId: null,
      targetId: genericTargetId,
      assignedByActorId: bottle.createdByActorId,
    });
    const existing = await fixtures.StorePrice({
      name: "Stable Expression Alias",
      externalSiteId: site.id,
      bottleId: staleBottle.id,
      targetId: staleTargetId,
    });
    await db
      .update(storePrices)
      .set({ releaseId: staleRelease.id })
      .where(eq(storePrices.id, existing.id));

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Stable Expression Alias",
            price: 7_999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/generic",
          },
        ],
      },
      { context: { user } },
    );

    const price = await db.query.storePrices.findFirst({
      where: eq(storePrices.externalSiteId, site.id),
    });
    expect(price).toMatchObject({
      id: existing.id,
      targetId: genericTargetId,
      bottleId: null,
      releaseId: null,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.anything(),
    );
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      expect.anything(),
    );
  });

  test("atomically replaces a stale complete tuple from an exact alias", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const expectedBottle = await fixtures.Bottle();
    const staleBottle = await fixtures.Bottle();
    const staleRelease = await fixtures.BottleRelease({
      bottleId: staleBottle.id,
    });
    const expectedTargetId = await getExactTargetId(expectedBottle.id);
    const staleTargetId = await getExactTargetId(staleBottle.id);
    const user = await fixtures.User({ admin: true });
    const name = "Atomic Exact Listing";
    await db.insert(bottleAliases).values({
      name,
      bottleId: expectedBottle.id,
      releaseId: null,
      targetId: expectedTargetId,
      assignedByActorId: expectedBottle.createdByActorId,
    });
    const existing = await fixtures.StorePrice({
      name,
      externalSiteId: site.id,
      bottleId: staleBottle.id,
      targetId: staleTargetId,
    });
    await db
      .update(storePrices)
      .set({ releaseId: staleRelease.id })
      .where(eq(storePrices.id, existing.id));

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name,
            price: 8_999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/exact-replacement",
          },
        ],
      },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, existing.id),
      }),
    ).toMatchObject({
      targetId: expectedTargetId,
      bottleId: expectedBottle.id,
      releaseId: null,
    });
  });

  test("rolls back price and history writes for a retired alias target", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ admin: true });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: null,
    });

    await expect(
      routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name: bottle.fullName,
              price: 10_999,
              currency: "usd",
              volume: 750,
              url: "http://example.com/retired-target",
            },
          ],
        },
        { context: { user } },
      ),
    ).rejects.toThrow("Catalog target is retired");

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
  });

  test("locks target identity before price, history, or alias mutation", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    const user = await fixtures.User({ admin: true });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let ingestion: ReturnType<typeof routerClient.prices.createBatch> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load target blocker pid.");
      await blocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [targetId],
      );

      ingestion = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name: bottle.fullName,
              price: 11_999,
              currency: "usd",
              volume: 750,
              url: "http://example.com/target-lock",
            },
          ],
        },
        { context: { user } },
      );
      void ingestion.catch(() => undefined);
      const ingestionPid = await waitForSessionBlockedBy(observer, blockerPid);
      const prematureMutationLocks = await observer.query<{ relname: string }>(
        `SELECT relation.relname
         FROM pg_locks AS lock
         INNER JOIN pg_class AS relation ON relation.oid = lock.relation
         WHERE lock.pid = $1
           AND lock.mode = 'RowExclusiveLock'
           AND relation.relname = ANY($2::text[])`,
        [ingestionPid, ["store_price", "store_price_history", "bottle_alias"]],
      );
      expect(prematureMutationLocks.rows).toHaveLength(0);

      await blocker.query("COMMIT");
      blockerReleased = true;
      await ingestion;
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (ingestion) await ingestion.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject({
      targetId,
      bottleId: bottle.id,
      releaseId: null,
    });
  });

  test("rolls back when an alias is retargeted while target locking waits", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const originalBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const originalTargetId = await getExactTargetId(originalBottle.id);
    const replacementTargetId = await getExactTargetId(replacementBottle.id);
    const user = await fixtures.User({ admin: true });
    const name = "Ardbeg 10 years old";
    expect(normalizeBottleAliasKey(name)).not.toBe(name);
    await db.insert(bottleAliases).values({
      name,
      bottleId: originalBottle.id,
      targetId: originalTargetId,
      assignedByActorId: originalBottle.createdByActorId,
    });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let ingestion: ReturnType<typeof routerClient.prices.createBatch> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load target blocker pid.");
      await blocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [originalTargetId],
      );

      ingestion = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name,
              price: 12_999,
              currency: "usd",
              volume: 750,
              url: "http://example.com/concurrent-retarget",
            },
          ],
        },
        { context: { user } },
      );
      void ingestion.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await observer.query(
        `UPDATE bottle_alias
         SET bottle_id = $1, target_id = $2
         WHERE name = $3`,
        [replacementBottle.id, replacementTargetId, name],
      );
      await blocker.query("COMMIT");
      blockerReleased = true;
      await expect(ingestion).rejects.toThrow("Bottle alias identity changed");
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (ingestion) await ingestion.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({
      bottleId: replacementBottle.id,
      targetId: replacementTargetId,
    });
  }, 15_000);

  test("does not resurrect a normalized alias deleted while target locking waits", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    const user = await fixtures.User({ admin: true });
    const name = normalizeBottleAliasKey("Ardbeg 12 years old");
    await db.insert(bottleAliases).values({
      name,
      bottleId: bottle.id,
      targetId,
      assignedByActorId: bottle.createdByActorId,
    });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let ingestion: ReturnType<typeof routerClient.prices.createBatch> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load target blocker pid.");
      await blocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [targetId],
      );

      ingestion = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name,
              price: 13_249,
              currency: "usd",
              volume: 750,
              url: "http://example.com/deleted-normalized-alias",
            },
          ],
        },
        { context: { user } },
      );
      void ingestion.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await observer.query("DELETE FROM bottle_alias WHERE name = $1", [name]);
      await blocker.query("COMMIT");
      blockerReleased = true;
      await expect(ingestion).rejects.toThrow("Bottle alias identity changed");
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (ingestion) await ingestion.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toBeUndefined();
  }, 15_000);

  test("rolls back when only the matched alias ignored state changes", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    const user = await fixtures.User({ admin: true });
    const name = normalizeBottleAliasKey("Ardbeg 14 years old");
    await db.insert(bottleAliases).values({
      name,
      bottleId: bottle.id,
      targetId,
      ignored: false,
      assignedByActorId: bottle.createdByActorId,
    });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let ingestion: ReturnType<typeof routerClient.prices.createBatch> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load target blocker pid.");
      await blocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [targetId],
      );

      ingestion = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name,
              price: 13_349,
              currency: "usd",
              volume: 750,
              url: "http://example.com/ignored-alias-race",
            },
          ],
        },
        { context: { user } },
      );
      void ingestion.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await observer.query(
        "UPDATE bottle_alias SET ignored = true WHERE name = $1",
        [name],
      );
      await blocker.query("COMMIT");
      blockerReleased = true;
      await expect(ingestion).rejects.toThrow("Bottle alias identity changed");
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (ingestion) await ingestion.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({ ignored: true, targetId });
  }, 15_000);

  test("rolls back when staged release promotion completes before serialization", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    if (parent.groupId === null)
      throw new Error("Parent group fixture missing.");
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        createdByActorId: parent.createdByActorId,
        name: "Concurrent promoted Bottle",
        fullName: "Concurrent promoted Bottle",
      })
      .returning();
    if (!promotedBottle) throw new Error("Promoted Bottle fixture missing.");
    await db.insert(catalogTargets).values({
      groupId: parent.groupId,
      bottleId: promotedBottle.id,
    });
    const name = "Concurrent Staged Release Alias";
    await db.insert(bottleAliases).values({
      name,
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      assignedByActorId: parent.createdByActorId,
    });
    const user = await fixtures.User({ admin: true });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let ingestion: ReturnType<typeof routerClient.prices.createBatch> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load parent blocker pid.");
      await blocker.query("SELECT id FROM bottle WHERE id = $1 FOR UPDATE", [
        parent.id,
      ]);

      ingestion = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name,
              price: 13_449,
              currency: "usd",
              volume: 750,
              url: "http://example.com/staged-promotion-race",
            },
          ],
        },
        { context: { user } },
      );
      void ingestion.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await observer.query(
        `INSERT INTO bottle_release_promotion
           (release_id, promoted_bottle_id, status, completed_at, created_by_actor_id)
         VALUES ($1, $2, 'promoted', NOW(), $3)`,
        [release.id, promotedBottle.id, parent.createdByActorId],
      );
      await blocker.query("COMMIT");
      blockerReleased = true;
      await expect(ingestion).rejects.toThrow(
        "assignment changed before targetless use",
      );
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (ingestion) await ingestion.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({
      targetId: null,
      bottleId: parent.id,
      releaseId: release.id,
    });
  }, 15_000);

  test("rolls back when a staged ungrouped parent gains its target before serialization", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const parent = await fixtures.LegacyBottle();
    expect(parent.groupId).toBeNull();
    expect(
      await db.query.catalogTargets.findFirst({
        where: eq(catalogTargets.bottleId, parent.id),
      }),
    ).toBeUndefined();
    const name = "Concurrent Staged Parent Alias";
    await db.insert(bottleAliases).values({
      name,
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      assignedByActorId: parent.createdByActorId,
    });
    const user = await fixtures.User({ admin: true });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let ingestion: ReturnType<typeof routerClient.prices.createBatch> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load parent blocker pid.");
      await blocker.query("SELECT id FROM bottle WHERE id = $1 FOR UPDATE", [
        parent.id,
      ]);

      ingestion = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name,
              price: 13_549,
              currency: "usd",
              volume: 750,
              url: "http://example.com/staged-parent-race",
            },
          ],
        },
        { context: { user } },
      );
      void ingestion.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      const groupId = (
        await blocker.query<{ id: string }>(
          `INSERT INTO bottle_group
             (full_name, name, brand_id, created_by_actor_id)
           SELECT full_name, name, brand_id, created_by_actor_id
           FROM bottle
           WHERE id = $1
           RETURNING id`,
          [parent.id],
        )
      ).rows[0]?.id;
      if (!groupId) throw new Error("Unable to create parent group.");
      await blocker.query("UPDATE bottle SET group_id = $1 WHERE id = $2", [
        groupId,
        parent.id,
      ]);
      await blocker.query(
        `INSERT INTO catalog_target (bottle_group_id, bottle_id)
         VALUES ($1, NULL), ($1, $2)`,
        [groupId, parent.id],
      );
      await blocker.query("COMMIT");
      blockerReleased = true;
      await expect(ingestion).rejects.toThrow(
        "assignment changed before targetless use",
      );
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (ingestion) await ingestion.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({
      targetId: null,
      bottleId: parent.id,
      releaseId: null,
    });
    expect(
      await db.query.catalogTargets.findFirst({
        where: eq(catalogTargets.bottleId, parent.id),
      }),
    ).toMatchObject({ bottleId: parent.id });
  }, 15_000);

  test("rolls back when a target retires while hierarchy locking waits", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const user = await fixtures.User({ admin: true });
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let ingestion: ReturnType<typeof routerClient.prices.createBatch> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load group blocker pid.");
      await blocker.query(
        "SELECT id FROM bottle_group WHERE id = $1 FOR UPDATE",
        [bottle.groupId],
      );

      ingestion = routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name: bottle.fullName,
              price: 13_499,
              currency: "usd",
              volume: 750,
              url: "http://example.com/concurrent-retirement",
            },
          ],
        },
        { context: { user } },
      );
      void ingestion.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await observer.query(
        `INSERT INTO bottle_tombstone (bottle_id, new_bottle_id)
         VALUES ($1, NULL)`,
        [bottle.id],
      );
      await blocker.query("COMMIT");
      blockerReleased = true;
      await expect(ingestion).rejects.toThrow("Catalog target is retired");
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (ingestion) await ingestion.catch(() => undefined);
    }

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
  }, 15_000);

  test("finalizes a matched price image onto an empty Bottle image", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
      imageUrl: null,
    });
    const imageUrl = "http://example.com/retailer-bottle.jpg";
    await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: bottle.fullName,
      volume: 750,
      imageUrl,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: bottle.fullName,
            price: 9999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/finalized-image",
          },
        ],
      },
      { context: { user } },
    );

    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ imageUrl });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: (prices, { and, eq }) =>
        and(
          eq(prices.externalSiteId, site.id),
          eq(prices.name, bottle.fullName),
        ),
    });
    const exactAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, bottle.fullName),
    });
    expect(updatedPrice).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: exactAlias?.targetId,
      imageUrl,
    });
    expect(exactAlias?.targetId).toEqual(expect.any(Number));
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "CapturePriceImage",
      expect.anything(),
    );
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("processes existing price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    expect(bottle.fullName).toBe("Ardbeg 10-year-old");
    const existingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
    });
    expect(existingPrice.name).toBe(bottle.fullName);

    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old",
            price: 2999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
          },
        ],
      },
      { context: { user } },
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(prices.length).toBe(1);
    expect(prices[0].id).toBe(existingPrice.id);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].price).toBe(2999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(prices[0].url).toBe("http://example.com");
  });

  test("retains a promotion-incomplete release alias as targetless", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "Reserve",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 1",
      abv: 46,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: release.fullName,
            price: 4999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/release",
          },
        ],
      },
      { context: { user } },
    );

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    const normalizedReleaseName = normalizeBottle({
      name: release.fullName,
    }).name;

    expect(price).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
      name: normalizedReleaseName,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.anything(),
    );
  });

  test("upgrades a promoted legacy release alias to its exact target", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        createdByActorId: parent.createdByActorId,
        name: "Promoted price Bottle",
        fullName: "Promoted price Bottle",
      })
      .returning();
    if (!promotedBottle || parent.groupId === null) {
      throw new Error("Unable to create promoted Bottle fixture.");
    }
    const [promotedTarget] = await db
      .insert(catalogTargets)
      .values({
        groupId: parent.groupId,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!promotedTarget) {
      throw new Error("Unable to create promoted target fixture.");
    }
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    const name = "Promoted Legacy Price Alias";
    await db.insert(bottleAliases).values({
      name,
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      assignedByActorId: parent.createdByActorId,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name,
            price: 9_999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/promoted",
          },
        ],
      },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject({
      targetId: promotedTarget.id,
      bottleId: parent.id,
      releaseId: release.id,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({
      targetId: promotedTarget.id,
      bottleId: promotedBottle.id,
      releaseId: null,
    });
  });

  test("upgrades a legacy parent alias to its generic target", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    const genericTargetId = await getGenericTargetId(parent.groupId!);
    const name = "Legacy Generic Price Alias";
    await db.insert(bottleAliases).values({
      name,
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      assignedByActorId: parent.createdByActorId,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name,
            price: 10_499,
            currency: "usd",
            volume: 750,
            url: "http://example.com/legacy-generic",
          },
        ],
      },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject({
      targetId: genericTargetId,
      bottleId: parent.id,
      releaseId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({
      targetId: genericTargetId,
      bottleId: null,
      releaseId: null,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.anything(),
    );
  });

  test("retains a validated legacy pair from a target-backed generic alias", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    const genericTargetId = await getGenericTargetId(parent.groupId!);
    const name = "Target-backed Generic Legacy Pair";
    await db.insert(bottleAliases).values({
      name,
      bottleId: parent.id,
      releaseId: null,
      targetId: genericTargetId,
      assignedByActorId: parent.createdByActorId,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name,
            price: 10_749,
            currency: "usd",
            volume: 750,
            url: "http://example.com/generic-retained-pair",
          },
        ],
      },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toMatchObject({
      targetId: genericTargetId,
      bottleId: parent.id,
      releaseId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({
      targetId: genericTargetId,
      bottleId: null,
      releaseId: null,
    });
  });

  test("rejects a generic alias retained pair that resolves elsewhere", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const targetParent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: targetParent.id });
    const retainedParent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: retainedParent.id });
    const genericTargetId = await getGenericTargetId(targetParent.groupId!);
    const name = "Invalid Generic Legacy Pair";
    await db.insert(bottleAliases).values({
      name,
      bottleId: retainedParent.id,
      releaseId: null,
      targetId: genericTargetId,
      assignedByActorId: targetParent.createdByActorId,
    });
    const user = await fixtures.User({ admin: true });

    await expect(
      routerClient.prices.createBatch(
        {
          site: site.type,
          prices: [
            {
              name,
              price: 10_999,
              currency: "usd",
              volume: 750,
              url: "http://example.com/invalid-generic-retained-pair",
            },
          ],
        },
        { context: { user } },
      ),
    ).rejects.toThrow("retained pair resolves to another target");

    expect(
      await db.query.storePrices.findMany({
        where: eq(storePrices.externalSiteId, site.id),
      }),
    ).toHaveLength(0);
    expect(await db.select().from(storePriceHistories)).toHaveLength(0);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, name),
      }),
    ).toMatchObject({
      targetId: genericTargetId,
      bottleId: retainedParent.id,
    });
  });

  test("targetless legacy aliases replace only targetless price identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const legacyBottle = await fixtures.LegacyBottle();
    const legacyRelease = await fixtures.BottleRelease({
      bottleId: legacyBottle.id,
    });
    const previousBottle = await fixtures.LegacyBottle();
    const previousRelease = await fixtures.BottleRelease({
      bottleId: previousBottle.id,
    });
    expect(legacyRelease.id).not.toBe(previousRelease.id);
    const name = "Staged Targetless Listing";
    await db.insert(bottleAliases).values({
      name,
      bottleId: legacyBottle.id,
      releaseId: legacyRelease.id,
      targetId: null,
      assignedByActorId: legacyBottle.createdByActorId,
    });
    const existing = await fixtures.StorePrice({
      name,
      externalSiteId: site.id,
      bottleId: previousBottle.id,
      targetId: null,
    });
    await db
      .update(storePrices)
      .set({ releaseId: previousRelease.id })
      .where(eq(storePrices.id, existing.id));
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name,
            price: 5_999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/targetless",
          },
        ],
      },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, existing.id),
      }),
    ).toMatchObject({
      targetId: null,
      bottleId: legacyBottle.id,
      releaseId: legacyRelease.id,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      expect.anything(),
    );
  });

  test("targetless legacy aliases cannot downgrade durable price identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const legacyBottle = await fixtures.LegacyBottle();
    const durableBottle = await fixtures.Bottle();
    const durableTargetId = await getExactTargetId(durableBottle.id);
    const name = "Durable Price Listing";
    await db.insert(bottleAliases).values({
      name,
      bottleId: legacyBottle.id,
      targetId: null,
      assignedByActorId: legacyBottle.createdByActorId,
    });
    const existing = await fixtures.StorePrice({
      name,
      externalSiteId: site.id,
      bottleId: durableBottle.id,
      targetId: durableTargetId,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name,
            price: 6_999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/durable",
          },
        ],
      },
      { context: { user } },
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, existing.id),
      }),
    ).toMatchObject({
      targetId: durableTargetId,
      bottleId: durableBottle.id,
      releaseId: null,
    });
  });

  test("processes new price without bottle", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old",
            price: 2999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
          },
        ],
      },
      { context: { user } },
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));
    expect(prices.length).toBe(1);
    expect(prices[0].bottleId).toBeNull();
    expect(prices[0].price).toBe(2999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(prices[0].url).toBe("http://example.com");
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Ardbeg 10-year-old"),
      }),
    ).toBeUndefined();
    expect(workerClient.pushJob).not.toHaveBeenCalled();
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: prices[0].id,
      },
    );
  });

  test("uses identity-preserving alias keys as exact matches", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    expect(bottle.fullName).toBe("Ardbeg 10-year-old");
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10 years old",
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/normalized-alias",
          },
        ],
      },
      { context: { user } },
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(prices.length).toBe(1);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].releaseId).toBeNull();
    expect(prices[0].name).toBe("Ardbeg 10-year-old");
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("falls back to existing raw aliases for legacy exact matches", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const rawName = "Ardbeg 10 years old";
    const aliasKey = normalizeBottleAliasKey(rawName);
    expect(aliasKey).not.toBe(rawName);
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: rawName,
    });
    const rawReview = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: rawName,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: rawName,
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/legacy-raw-alias",
          },
        ],
      },
      { context: { user } },
    );

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, aliasKey),
    });
    const updatedRawReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, rawReview.id),
    });

    expect(price.bottleId).toBe(bottle.id);
    expect(price.targetId).toBe(alias?.targetId);
    expect(updatedRawReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: alias?.targetId,
    });
    expect(alias).toMatchObject({
      bottleId: bottle.id,
      targetId: expect.any(Number),
      assignmentSource: "source_approved",
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("does not use lossy normalized listing names as exact matches", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "Distillers Edition",
      brandId: (await fixtures.Entity({ name: "Lagavulin" })).id,
    });
    expect(bottle.fullName).toBe("Lagavulin Distillers Edition");
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Lagavulin Distillers Edition 2011 Release",
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/lossy-normalized-alias",
          },
        ],
      },
      { context: { user } },
    );

    const [price] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(price.bottleId).toBeNull();
    expect(price.releaseId).toBeNull();
    expect(price.name).toBe(bottle.fullName);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: price.id,
      },
    );
  });

  test("writes the same accepted alias key used for lookup", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const rawName = "Ardbeg 10 years old Whisky";
    const aliasKey = normalizeBottleAliasKey(rawName);
    expect(aliasKey).not.toBe(rawName);

    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: aliasKey,
    });
    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: rawName,
            price: 3999,
            currency: "usd",
            volume: 750,
            url: "http://example.com/raw-alias",
          },
        ],
      },
      { context: { user } },
    );

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, aliasKey),
    });
    expect(alias).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, rawName),
      }),
    ).toBeUndefined();
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("does not unset bottle for existing price", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    expect(bottle.fullName).toBe("Ardbeg 10-year-old");
    const targetId = await getExactTargetId(bottle.id);
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const existingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId,
      name: "Ardbeg 10-year-old Single Malt",
      externalSiteId: site.id,
    });
    await db
      .update(storePrices)
      .set({ releaseId: release.id })
      .where(eq(storePrices.id, existingPrice.id));

    const user = await fixtures.User({ admin: true });

    await routerClient.prices.createBatch(
      {
        site: site.type,
        prices: [
          {
            name: "Ardbeg 10-year-old Single Malt",
            price: 2999,
            currency: "usd",
            volume: 750,
            url: "http://example.com",
          },
        ],
      },
      { context: { user } },
    );

    const prices = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id));

    expect(prices.length).toBe(1);
    expect(prices[0].id).toBe(existingPrice.id);
    expect(prices[0].bottleId).toBe(bottle.id);
    expect(prices[0].releaseId).toBe(release.id);
    expect(prices[0].targetId).toBe(targetId);
    expect(prices[0].price).toBe(2999);
    expect(prices[0].name).toBe("Ardbeg 10-year-old Single Malt");
    expect(prices[0].url).toBe("http://example.com");
  });
});
