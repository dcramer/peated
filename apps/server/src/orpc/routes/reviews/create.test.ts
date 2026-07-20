import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleAliases,
  bottleReleasePromotions,
  catalogTargets,
  incomingBottleDecisionLogs,
  reviews,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());
const pushJobMock = vi.hoisted(() => vi.fn());
const pushUniqueJobMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);

vi.mock("@peated/server/worker/client", () => ({
  pushJob: pushJobMock,
  pushUniqueJob: pushUniqueJobMock,
}));

function buildClassification(
  decision: Record<string, unknown>,
  artifacts: Record<string, unknown> = {},
) {
  return {
    status: "classified" as const,
    decision: {
      confidence: 0.92,
      rationale: "test fixture",
      candidateBottleIds: [],
      ...decision,
    },
    artifacts: {
      extractedIdentity: null,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
      ...artifacts,
    },
  };
}

function buildCreateBottleDecision({
  brandName,
  bottleName,
  category = "single_malt",
}: {
  brandName: string;
  bottleName: string;
  category?: "single_malt" | "bourbon" | "rye";
}) {
  return buildClassification({
    action: "create_bottle",
    proposedBottle: {
      name: bottleName,
      series: null,
      category,
      edition: null,
      statedAge: null,
      caskStrength: null,
      singleCask: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      brand: {
        id: null,
        name: brandName,
      },
      distillers: [],
      bottler: null,
    },
  });
}

async function recordCompletedPromotion(
  releaseId: number,
  promotedBottleId: number,
) {
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId,
    status: "promoted",
    completedAt: new Date(),
  });
}

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Review conflict upsert lock.");
}

describe("POST /reviews", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );
    pushJobMock.mockReset();
    pushUniqueJobMock.mockReset();
  });

  test("requires admin", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.reviews.create(
        {
          site: site.type,
          name: "Bottle Name",
          issue: "Default",
          rating: 89,
          url: "https://example.com",
          category: "single_malt",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("new review with new bottle no entity", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: "Bottle Name",
        issue: "Default",
        rating: 89,
        url: "https://example.com",
        category: "single_malt",
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    expect(review).toBeDefined();
    expect(review?.bottleId).toBeNull();
    expect(review?.name).toEqual("Bottle Name");
    expect(review?.issue).toEqual("Default");
    expect(review?.rating).toEqual(89);
    expect(review?.url).toEqual("https://example.com");

    const alias = await db.query.bottleAliases.findFirst({
      where: (table, { eq }) => eq(table.name, "Bottle Name"),
    });
    expect(alias).toBeUndefined();
  });

  test("new review with classifier-backed bottle creation", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const brand = await fixtures.Entity({ name: "Springbank" });
    const adminUser = await fixtures.User({ admin: true });
    const systemActor = await getPeatedSystemActor();

    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateBottleDecision({
        brandName: brand.name,
        bottleName: "Bottle Name",
      }),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: `${brand.name} Bottle Name`,
        issue: "Default",
        rating: 89,
        url: "https://example.com",
        category: "single_malt",
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    expect(review).toBeDefined();
    expect(review?.bottleId).toBeTruthy();
    expect(review?.name).toEqual(`${brand.name} Bottle Name`);
    expect(review?.issue).toEqual("Default");
    expect(review?.rating).toEqual(89);
    expect(review?.url).toEqual("https://example.com");

    const bottle = await db.query.bottles.findFirst({
      where: (table, { eq }) => eq(table.id, review!.bottleId as number),
    });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle!.id),
    });
    expect(bottle).toBeDefined();
    expect(bottle?.fullName).toEqual(`${brand.name} Bottle Name`);
    expect(bottle?.name).toEqual("Bottle Name");
    expect(bottle?.category).toEqual("single_malt");
    expect(bottle?.brandId).toEqual(brand.id);
    expect(review).toMatchObject({
      targetId: target!.id,
      bottleId: bottle!.id,
      releaseId: null,
    });

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, `${brand.name} Bottle Name`),
    });
    expect(alias).toMatchObject({
      bottleId: bottle!.id,
      releaseId: null,
      targetId: target!.id,
      assignmentSource: "classifier_approved",
      assignedByActorId: systemActor.id,
    });

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, review!.id),
      ),
    });
    expect(decisionLog).toMatchObject({
      sourceKind: "review",
      sourceId: review!.id,
      externalSiteId: site.id,
      decision: "create_bottle",
      actorId: systemActor.id,
      bottleId: bottle!.id,
      releaseId: null,
      targetId: target!.id,
      createdBottle: true,
      createdRelease: false,
      confidence: null,
      rationale: "test fixture",
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_bottle",
          parentBottleId: null,
          identityScope: null,
          observation: null,
          identityBasis: null,
          confidenceBasis: null,
        },
        initiatedByUserId: adminUser.id,
        resolutionSource: "classifier_create_bottle",
      }),
    });
    expect(pushUniqueJobMock).toHaveBeenCalledWith("IndexBottleSearchVectors", {
      bottleId: bottle!.id,
    });
  });

  test("classifier create decisions reuse an existing exact catalog target", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const brand = await fixtures.Entity({ name: "Existing Catalog Brand" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Existing Catalog Bottle",
    });
    await db
      .update(bottleAliases)
      .set({ assignmentSource: "canonical" })
      .where(
        and(
          eq(bottleAliases.bottleId, bottle.id),
          eq(bottleAliases.name, bottle.fullName),
        ),
      );
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = `${bottle.fullName} critic review`;

    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateBottleDecision({
        brandName: brand.name,
        bottleName: bottle.name,
      }),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: reviewName,
        issue: "Default",
        rating: 90,
        url: "https://example.com/reused-existing-catalog-bottle",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.id),
    });
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
    });
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, data.id),
      ),
    });

    expect(review).toMatchObject({
      targetId: target!.id,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(alias).toMatchObject({
      targetId: target!.id,
      bottleId: bottle.id,
      releaseId: null,
      assignmentSource: "classifier_approved",
    });
    expect(decisionLog).toMatchObject({
      decision: "match_existing",
      bottleId: bottle.id,
      releaseId: null,
      targetId: target!.id,
      createdBottle: false,
      createdRelease: false,
      metadata: expect.objectContaining({
        classifierEvidence: {
          action: "create_bottle",
          parentBottleId: null,
          identityScope: null,
          observation: null,
          identityBasis: null,
          confidenceBasis: null,
        },
        resolutionSource: "classifier_create_bottle",
      }),
    });
  });

  test("classifier-backed bottle creation reuses canonical entities by short name", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const adminUser = await fixtures.User({ admin: true });

    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateBottleDecision({
        brandName: "SMWS",
        bottleName: "72.123 Big moves and subtle details",
      }),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: "SMWS 72.123 Big moves and subtle details",
        issue: "Default",
        rating: 89,
        url: "https://example.com/smws",
        category: "single_malt",
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    const bottle = await db.query.bottles.findFirst({
      where: (table, { eq }) => eq(table.id, review!.bottleId as number),
    });

    expect(bottle?.brandId).toEqual(brand.id);
    expect(bottle?.bottlerId).toEqual(brand.id);

    const duplicateBrand = await db.query.entities.findFirst({
      where: (table, { eq }) => eq(table.name, "SMWS"),
    });
    expect(duplicateBrand).toBeUndefined();
  });

  test("new review with existing bottle", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Delicious",
      vintageYear: null,
      releaseYear: null,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: bottle.fullName,
        issue: "Default",
        rating: 89,
        url: "https://example.com",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    expect(review).toBeDefined();
    expect(review?.bottleId).toEqual(bottle.id);
    expect(review?.releaseId).toBeNull();
    expect(review?.targetId).toEqual(target?.id);
    expect(review?.name).toEqual(bottle.fullName);
    expect(review?.issue).toEqual("Default");
    expect(review?.rating).toEqual(89);
    expect(review?.url).toEqual("https://example.com");

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, review!.id),
      ),
    });
    expect(decisionLog).toBeUndefined();
  });

  test("new review keeps generic intent on the group target", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Generic Expression",
      vintageYear: null,
      releaseYear: null,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Legacy Release",
    });
    const adminUser = await fixtures.User({ admin: true });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          matchedReleaseId: null,
          candidateBottleIds: [bottle.id],
        },
        {
          candidates: [
            {
              bottleId: bottle.id,
              releaseId: null,
              fullName: bottle.fullName,
              bottleFullName: bottle.fullName,
              alias: bottle.fullName,
              brand: null,
              bottler: null,
              series: null,
              distillery: [],
              category: bottle.category,
              statedAge: bottle.statedAge,
              edition: null,
              caskStrength: bottle.caskStrength,
              singleCask: bottle.singleCask,
              abv: bottle.abv,
              vintageYear: bottle.vintageYear,
              releaseYear: bottle.releaseYear,
              caskType: bottle.caskType,
              caskSize: bottle.caskSize,
              caskFill: bottle.caskFill,
            },
          ],
        },
      ),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: `${bottle.fullName} review title`,
        issue: "Default",
        rating: 89,
        url: "https://example.com/generic-expression",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.id),
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId!),
        isNull(catalogTargets.bottleId),
      ),
    });
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(
        bottleAliases.name,
        normalizeBottleAliasKey(`${bottle.fullName} review title`),
      ),
    });

    expect(review).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      targetId: genericTarget?.id,
    });
    expect(alias).toMatchObject({
      bottleId: null,
      releaseId: null,
      targetId: review?.targetId,
    });
    expect(review?.targetId).not.toEqual(exactTarget?.id);
  });

  test("known classifier matches preserve explicitly staged unpromoted identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({ name: "Invalid Legacy Match" });
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = "Invalid Promotion Classifier Result";
    const reviewUrl = "https://example.com/invalid-promotion-classifier";

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          matchedReleaseId: release.id,
          candidateBottleIds: [bottle.id],
        },
        { candidates: [{ bottleId: bottle.id, releaseId: release.id }] },
      ),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: reviewName,
        issue: "Default",
        rating: 89,
        url: reviewUrl,
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      }),
    ).toMatchObject({
      targetId: null,
      bottleId: bottle.id,
      releaseId: release.id,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
      }),
    ).toMatchObject({
      targetId: null,
      bottleId: bottle.id,
      releaseId: release.id,
    });
  });

  test("grouping drift invalidates a staged targetless match before Review mutation", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const parent = await fixtures.LegacyBottle({
      name: "Concurrent Staged Review Parent",
    });
    const groupedBottle = await fixtures.Bottle({
      name: "Concurrent Staged Review Group Member",
    });
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = "Concurrent Staged Review Match";
    const reviewUrl = "https://example.com/concurrent-staged-review";
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation: ReturnType<typeof routerClient.reviews.create> | undefined;

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: parent.id,
          matchedReleaseId: null,
          candidateBottleIds: [parent.id],
        },
        { candidates: [{ bottleId: parent.id, releaseId: null }] },
      ),
    );

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `UPDATE "bottle" SET "group_id" = $1 WHERE "id" = $2`,
        [groupedBottle.groupId, parent.id],
      );
      await client.query(
        `INSERT INTO "catalog_target" ("bottle_group_id", "bottle_id") VALUES ($1, $2)`,
        [groupedBottle.groupId, parent.id],
      );

      creation = routerClient.reviews.create(
        {
          site: site.type,
          name: reviewName,
          issue: "Default",
          rating: 89,
          url: reviewUrl,
          category: parent.category,
        },
        { context: { user: adminUser } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      const error = await waitError(creation);
      expect(String(error)).toContain("changed before targetless use");
      expect(
        await db.query.reviews.findFirst({
          where: eq(reviews.url, reviewUrl),
        }),
      ).toBeUndefined();
      expect(
        await db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
        }),
      ).toBeUndefined();
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }
  });

  test("unresolved conflict preserves an existing durable identity tuple", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({ name: "Durable Review Bottle" });
    const existingReview = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: bottle.id,
      name: "Previously Resolved Review",
      url: "https://example.com/durable-review",
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: "Currently Unresolved Review",
        issue: existingReview.issue,
        rating: 91,
        url: existingReview.url,
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.id),
    });
    expect(review).toMatchObject({
      id: existingReview.id,
      targetId: existingReview.targetId,
      bottleId: existingReview.bottleId,
      releaseId: existingReview.releaseId,
      name: "Currently Unresolved Review",
      rating: 91,
    });
  });

  test("unresolved conflict preserves an existing targetless identity tuple", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Targetless Review Bottle",
    });
    const existingReview = await fixtures.Review({
      externalSiteId: site.id,
      targetId: null,
      bottleId: bottle.id,
      name: "Previously Targetless Review",
      url: "https://example.com/targetless-review",
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: "Currently Unresolved Targetless Review",
        issue: existingReview.issue,
        rating: 92,
        url: existingReview.url,
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      }),
    ).toMatchObject({
      id: existingReview.id,
      targetId: null,
      bottleId: bottle.id,
      releaseId: null,
      name: "Currently Unresolved Targetless Review",
      rating: 92,
    });
  });

  test("concurrent unresolved conflict preserves the committed durable identity tuple", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Concurrent Durable Review Bottle",
    });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    expect(target).toBeDefined();
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = "Concurrent Durable Review";
    const issue = "Default";
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation: ReturnType<typeof routerClient.reviews.create> | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `INSERT INTO "review"
          ("target_id", "bottle_id", "release_id", "external_site_id", "name", "issue", "rating", "url")
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
        [
          target!.id,
          bottle.id,
          site.id,
          reviewName,
          issue,
          80,
          "https://example.com/concurrent-durable-holder",
        ],
      );

      creation = routerClient.reviews.create(
        {
          site: site.type,
          name: reviewName,
          issue,
          rating: 94,
          url: "https://example.com/concurrent-durable-result",
          category: bottle.category,
        },
        { context: { user: adminUser } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      const data = await creation;
      const review = await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      });
      expect(review).toMatchObject({
        targetId: target!.id,
        bottleId: bottle.id,
        releaseId: null,
        name: reviewName,
        rating: 94,
        url: "https://example.com/concurrent-durable-result",
      });
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }
  });

  test("concurrent unresolved conflict preserves the committed targetless identity tuple", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Concurrent Targetless Review Bottle",
    });
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = "Concurrent Targetless Review";
    const issue = "Default";
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation: ReturnType<typeof routerClient.reviews.create> | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `INSERT INTO "review"
          ("target_id", "bottle_id", "release_id", "external_site_id", "name", "issue", "rating", "url")
         VALUES (NULL, $1, NULL, $2, $3, $4, $5, $6)`,
        [
          bottle.id,
          site.id,
          reviewName,
          issue,
          81,
          "https://example.com/concurrent-targetless-holder",
        ],
      );

      creation = routerClient.reviews.create(
        {
          site: site.type,
          name: reviewName,
          issue,
          rating: 95,
          url: "https://example.com/concurrent-targetless-result",
          category: bottle.category,
        },
        { context: { user: adminUser } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      const data = await creation;
      expect(
        await db.query.reviews.findFirst({
          where: eq(reviews.id, data.id),
        }),
      ).toMatchObject({
        targetId: null,
        bottleId: bottle.id,
        releaseId: null,
        name: reviewName,
        rating: 95,
        url: "https://example.com/concurrent-targetless-result",
      });
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }
  });

  test("concurrent resolved conflict atomically replaces the complete identity tuple", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const heldBottle = await fixtures.Bottle({
      name: "Concurrent Held Identity",
    });
    const heldTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, heldBottle.id),
    });
    const incomingBottle = await fixtures.Bottle({
      name: "Concurrent Incoming Identity",
    });
    const incomingTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, incomingBottle.id),
    });
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = "Concurrent Resolved Review Title";
    const issue = "Default";
    const reviewUrl = "https://example.com/concurrent-resolved-result";
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation: ReturnType<typeof routerClient.reviews.create> | undefined;

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: incomingBottle.id,
          matchedReleaseId: null,
          candidateBottleIds: [incomingBottle.id],
        },
        {
          candidates: [
            {
              bottleId: incomingBottle.id,
              releaseId: null,
            },
          ],
        },
      ),
    );

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `INSERT INTO "review"
          ("target_id", "bottle_id", "release_id", "external_site_id", "name", "issue", "rating", "url")
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
        [
          heldTarget!.id,
          heldBottle.id,
          site.id,
          reviewName,
          issue,
          82,
          "https://example.com/concurrent-resolved-holder",
        ],
      );

      creation = routerClient.reviews.create(
        {
          site: site.type,
          name: reviewName,
          issue,
          rating: 96,
          url: reviewUrl,
          category: incomingBottle.category,
        },
        { context: { user: adminUser } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      const data = await creation;
      const review = await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      });
      const alias = await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
      });
      const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "review"),
          eq(incomingBottleDecisionLogs.sourceId, data.id),
        ),
      });

      expect(review).toMatchObject({
        targetId: incomingTarget!.id,
        bottleId: incomingBottle.id,
        releaseId: null,
        rating: 96,
        url: reviewUrl,
      });
      expect(alias).toMatchObject({
        targetId: incomingTarget!.id,
        bottleId: incomingBottle.id,
        releaseId: null,
        assignmentSource: "classifier_approved",
      });
      expect(decisionLog).toMatchObject({
        decision: "match_existing",
        bottleId: incomingBottle.id,
        releaseId: null,
        createdBottle: false,
        createdRelease: false,
      });
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }
  });

  test("concurrent classifier conflict preserves durable identity without contradictory audit evidence", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const durableBottle = await fixtures.Bottle({
      name: "Concurrent Classifier Durable Bottle",
    });
    const durableTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, durableBottle.id),
    });
    const brand = await fixtures.Entity({ name: "Conflict Distillery" });
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = `${brand.name} Classifier Conflict Bottle Review Title`;
    const issue = "Default";
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation: ReturnType<typeof routerClient.reviews.create> | undefined;

    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateBottleDecision({
        brandName: brand.name,
        bottleName: "Classifier Conflict Bottle",
      }),
    );

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        `INSERT INTO "review"
          ("target_id", "bottle_id", "release_id", "external_site_id", "name", "issue", "rating", "url")
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
        [
          durableTarget!.id,
          durableBottle.id,
          site.id,
          reviewName,
          issue,
          82,
          "https://example.com/concurrent-classifier-holder",
        ],
      );

      creation = routerClient.reviews.create(
        {
          site: site.type,
          name: reviewName,
          issue,
          rating: 96,
          url: "https://example.com/concurrent-classifier-result",
          category: durableBottle.category,
        },
        { context: { user: adminUser } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      const data = await creation;
      const review = await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      });
      expect(review).toMatchObject({
        targetId: durableTarget!.id,
        bottleId: durableBottle.id,
        releaseId: null,
        name: reviewName,
        rating: 96,
        url: "https://example.com/concurrent-classifier-result",
      });
      expect(
        await db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
        }),
      ).toBeUndefined();
      expect(
        await db.query.incomingBottleDecisionLogs.findFirst({
          where: and(
            eq(incomingBottleDecisionLogs.sourceKind, "review"),
            eq(incomingBottleDecisionLogs.sourceId, review!.id),
          ),
        }),
      ).toBeUndefined();
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }
  });

  test("preselected classifier conflict preserves durable Review identity without contradictory evidence", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const durableBottle = await fixtures.Bottle({
      name: "Preselected Classifier Durable Bottle",
    });
    const incomingBrand = await fixtures.Entity({
      name: "Preselected Classifier Incoming Brand",
    });
    const existingReview = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: durableBottle.id,
      name: "Previously Durable Classifier Review",
      url: "https://example.com/preselected-classifier-review",
    });
    const adminUser = await fixtures.User({ admin: true });
    const reviewName = `${incomingBrand.name} Rejected Bottle`;

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "create_bottle",
          proposedBottle: {
            name: "Rejected Bottle",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: null,
            abv: null,
            caskStrength: null,
            singleCask: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: { id: incomingBrand.id, name: incomingBrand.name },
            distillers: [],
            bottler: null,
          },
        },
        { candidates: [] },
      ),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: reviewName,
        issue: existingReview.issue,
        rating: 97,
        url: existingReview.url,
        category: "single_malt",
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.id),
    });
    expect(review).toMatchObject({
      id: existingReview.id,
      targetId: existingReview.targetId,
      bottleId: durableBottle.id,
      releaseId: null,
      name: reviewName,
      rating: 97,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
      }),
    ).toMatchObject({
      bottleId: expect.any(Number),
      releaseId: null,
      targetId: expect.any(Number),
    });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "review"),
          eq(incomingBottleDecisionLogs.sourceId, review!.id),
        ),
      }),
    ).toBeUndefined();
  });

  test("resolved conflict replaces the complete durable identity tuple", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const previousBottle = await fixtures.Bottle({ name: "Previous Bottle" });
    const resolvedBottle = await fixtures.Bottle({ name: "Resolved Bottle" });
    const existingReview = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: previousBottle.id,
      name: resolvedBottle.fullName,
      url: "https://example.com/resolved-review",
    });
    const resolvedTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, resolvedBottle.id),
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: resolvedBottle.fullName,
        issue: existingReview.issue,
        rating: 93,
        url: "https://example.com/resolved-review-updated",
        category: resolvedBottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.id),
    });
    expect(review).toMatchObject({
      id: existingReview.id,
      targetId: resolvedTarget?.id,
      bottleId: resolvedBottle.id,
      releaseId: null,
      url: "https://example.com/resolved-review-updated",
    });
  });

  test("new review uses identity-preserving alias keys before classifier", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: (await fixtures.Entity({ name: "Ardbeg" })).id,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: "Ardbeg 10 years old",
        issue: "Default",
        rating: 89,
        url: "https://example.com/ardbeg-10",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    expect(review).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      name: bottle.fullName,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("durable exact aliases stay exact when the Bottle has legacy child releases", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({ name: "Exact Alias Expression" });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Legacy Child",
    });
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId!),
        isNull(catalogTargets.bottleId),
      ),
    });
    const aliasName = "Authoritative Exact Review Alias";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: exactTarget!.id,
      name: aliasName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: aliasName,
        issue: "Default",
        rating: 89,
        url: "https://example.com/authoritative-exact-review-alias",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.id),
    });
    expect(review).toMatchObject({
      targetId: exactTarget!.id,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(review?.targetId).not.toEqual(genericTarget?.id);
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("targetless exact aliases upgrade to the measured exact target", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Mappable Exact Alias Bottle",
    });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const aliasName = "Mappable Targetless Exact Review Alias";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: null,
      name: aliasName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: aliasName,
        issue: "Default",
        rating: 89,
        url: "https://example.com/mappable-targetless-exact-review-alias",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      }),
    ).toMatchObject({
      targetId: target!.id,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(aliasName)),
      }),
    ).toMatchObject({
      targetId: target!.id,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("targetless exact aliases upgrade to the measured generic target", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Mappable Generic Alias Bottle",
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Legacy Release",
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId!),
        isNull(catalogTargets.bottleId),
      ),
    });
    const aliasName = "Mappable Targetless Generic Review Alias";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: null,
      name: aliasName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: aliasName,
        issue: "Default",
        rating: 89,
        url: "https://example.com/mappable-targetless-generic-review-alias",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      }),
    ).toMatchObject({
      targetId: genericTarget!.id,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(aliasName)),
      }),
    ).toMatchObject({
      targetId: genericTarget!.id,
      bottleId: null,
      releaseId: null,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("targetless exact aliases retain staged legacy identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Staged Legacy Alias Bottle",
    });
    const aliasName = "Staged Legacy Exact Review Alias";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: null,
      name: aliasName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: aliasName,
        issue: "Default",
        rating: 89,
        url: "https://example.com/staged-legacy-review-alias",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.id),
    });
    expect(review).toMatchObject({
      targetId: null,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("targetless release aliases retain staged unpromoted identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Staged Unpromoted Alias Bottle",
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Unpromoted Release",
    });
    const aliasName = "Staged Unpromoted Exact Review Alias";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
      name: aliasName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: aliasName,
        issue: "Default",
        rating: 89,
        url: "https://example.com/staged-unpromoted-review-alias",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, data.id),
      }),
    ).toMatchObject({
      targetId: null,
      bottleId: bottle.id,
      releaseId: release.id,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("invalid targetless exact alias mappings fail without review writes", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Invalid Targetless Alias Parent",
    });
    const otherBottle = await fixtures.LegacyBottle({
      name: "Invalid Targetless Alias Release Owner",
    });
    const release = await fixtures.BottleRelease({
      bottleId: otherBottle.id,
      edition: "Wrong Parent",
    });
    const aliasName = "Invalid Targetless Exact Review Alias";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
      name: aliasName,
    });
    const adminUser = await fixtures.User({ admin: true });
    const reviewUrl = "https://example.com/invalid-targetless-review-alias";

    const error = await waitError(() =>
      routerClient.reviews.create(
        {
          site: site.type,
          name: aliasName,
          issue: "Default",
          rating: 89,
          url: reviewUrl,
          category: bottle.category,
        },
        { context: { user: adminUser } },
      ),
    );

    expect(String(error)).toContain(
      "release does not belong to the supplied parent Bottle",
    );
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.url, reviewUrl),
      }),
    ).toBeUndefined();
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("new review falls back to existing raw aliases before classifier", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
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
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: rawName,
        issue: "Default",
        rating: 89,
        url: "https://example.com/ardbeg-10-legacy",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, aliasKey),
    });

    expect(review).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      name: bottle.fullName,
    });
    expect(alias).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("new review does not use lossy normalized names as exact aliases", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const brand = await fixtures.Entity({ name: "Lagavulin" });
    const bottle = await fixtures.Bottle({
      name: "Distillers Edition",
      brandId: brand.id,
    });
    const classifierBottle = await fixtures.Bottle({
      name: "Distillers Edition 2011 Release",
      brandId: brand.id,
    });
    const adminUser = await fixtures.User({ admin: true });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: classifierBottle.id,
          matchedReleaseId: null,
          candidateBottleIds: [classifierBottle.id],
        },
        {
          candidates: [
            {
              bottleId: classifierBottle.id,
              releaseId: null,
              fullName: classifierBottle.fullName,
              bottleFullName: classifierBottle.fullName,
              alias: classifierBottle.fullName,
              brand: null,
              bottler: null,
              series: null,
              distillery: [],
              category: classifierBottle.category,
              statedAge: classifierBottle.statedAge,
              edition: null,
              caskStrength: classifierBottle.caskStrength,
              singleCask: classifierBottle.singleCask,
              abv: classifierBottle.abv,
              vintageYear: classifierBottle.vintageYear,
              releaseYear: classifierBottle.releaseYear,
              caskType: classifierBottle.caskType,
              caskSize: classifierBottle.caskSize,
              caskFill: classifierBottle.caskFill,
            },
          ],
        },
      ),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: "Lagavulin Distillers Edition 2011 Release",
        issue: "Default",
        rating: 89,
        url: "https://example.com/lagavulin-2011",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    expect(review).toMatchObject({
      bottleId: classifierBottle.id,
      releaseId: null,
      name: bottle.fullName,
    });
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(
        bottleAliases.name,
        normalizeBottleAliasKey("Lagavulin Distillers Edition 2011 Release"),
      ),
    });
    expect(alias).toMatchObject({
      bottleId: classifierBottle.id,
      releaseId: null,
    });
  });

  test("new review can match an existing bottle through the classifier", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Bottle Name",
      vintageYear: null,
      releaseYear: null,
    });
    const adminUser = await fixtures.User({ admin: true });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          matchedReleaseId: null,
          candidateBottleIds: [bottle.id],
        },
        {
          candidates: [
            {
              bottleId: bottle.id,
              releaseId: null,
              fullName: bottle.fullName,
              bottleFullName: bottle.fullName,
              alias: bottle.fullName,
              brand: null,
              bottler: null,
              series: null,
              distillery: [],
              category: bottle.category,
              statedAge: bottle.statedAge,
              edition: null,
              caskStrength: bottle.caskStrength,
              singleCask: bottle.singleCask,
              abv: bottle.abv,
              vintageYear: bottle.vintageYear,
              releaseYear: bottle.releaseYear,
              caskType: bottle.caskType,
              caskSize: bottle.caskSize,
              caskFill: bottle.caskFill,
            },
          ],
        },
      ),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: `${bottle.fullName} review title`,
        issue: "Default",
        rating: 89,
        url: "https://example.com",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    expect(review?.bottleId).toEqual(bottle.id);
    expect(review?.releaseId).toBeNull();

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "review"),
        eq(incomingBottleDecisionLogs.sourceId, review!.id),
      ),
    });
    expect(decisionLog).toMatchObject({
      decision: "match_existing",
      actorId: (await getPeatedSystemActor()).id,
      bottleId: bottle.id,
      releaseId: null,
      createdBottle: false,
      createdRelease: false,
      confidence: null,
      metadata: expect.objectContaining({
        initiatedByUserId: adminUser.id,
      }),
    });
  });

  test("new review with existing release", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Cadboll Estate",
      vintageYear: null,
      releaseYear: null,
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} - Batch 4`,
      name: `${bottle.name} - Batch 4`,
      edition: "Batch 4",
    });
    const promotedBottle = await fixtures.Bottle({
      name: "Cadboll Estate Batch 4 Promoted",
    });
    await recordCompletedPromotion(release.id, promotedBottle.id);
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: release.fullName,
        issue: "Default",
        rating: 89,
        url: "https://example.com/batch-4",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    const promotedTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, promotedBottle.id),
    });
    expect(review).toBeDefined();
    expect(review?.bottleId).toEqual(bottle.id);
    expect(review?.releaseId).toEqual(release.id);
    expect(review?.targetId).toEqual(promotedTarget?.id);
    expect(data.target).toMatchObject({
      kind: "bottle",
      targetId: promotedTarget?.id,
      bottle: { id: promotedBottle.id },
    });
  });

  test("preserves raw release alias text when normalization would strip release identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Calvados Cask Finished",
      vintageYear: null,
      releaseYear: null,
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} (2024 Release)`,
      name: `${bottle.name} (2024 Release)`,
      releaseYear: 2024,
    });
    const promotedBottle = await fixtures.Bottle({
      name: "Calvados Cask Finished 2024 Promoted",
    });
    await recordCompletedPromotion(release.id, promotedBottle.id);
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: release.fullName,
        issue: "Default",
        rating: 91,
        url: "https://example.com/2024-release",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    expect(review).toBeDefined();
    expect(review?.releaseId).toEqual(release.id);
    expect(review?.name).toEqual(release.fullName);

    const normalizedReleaseAlias = await db.query.bottleAliases.findFirst({
      where: and(
        eq(bottleAliases.name, bottle.fullName),
        eq(bottleAliases.releaseId, release.id),
      ),
    });
    expect(normalizedReleaseAlias).toBeUndefined();
  });

  test("preserves raw review name for classifier-resolved releases when normalization strips release identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Calvados Cask Finished",
      vintageYear: null,
      releaseYear: null,
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} (2024 Release)`,
      name: `${bottle.name} (2024 Release)`,
      releaseYear: 2024,
    });
    const promotedBottle = await fixtures.Bottle({
      name: "Classifier Calvados 2024 Promoted",
    });
    await recordCompletedPromotion(release.id, promotedBottle.id);
    const adminUser = await fixtures.User({ admin: true });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          matchedReleaseId: release.id,
          candidateBottleIds: [bottle.id],
        },
        {
          candidates: [
            {
              bottleId: bottle.id,
              releaseId: release.id,
              fullName: release.fullName,
              bottleFullName: bottle.fullName,
              alias: release.fullName,
              brand: null,
              bottler: null,
              series: null,
              distillery: [],
              category: bottle.category,
              statedAge: bottle.statedAge,
              edition: release.edition,
              caskStrength: release.caskStrength,
              singleCask: release.singleCask,
              abv: release.abv,
              vintageYear: release.vintageYear,
              releaseYear: release.releaseYear,
              caskType: release.caskType,
              caskSize: release.caskSize,
              caskFill: release.caskFill,
            },
          ],
        },
      ),
    );

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: release.fullName,
        issue: "Default",
        rating: 91,
        url: "https://example.com/2024-release-from-classifier",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, data.id),
    });
    expect(review?.releaseId).toEqual(release.id);
    expect(review?.name).toEqual(release.fullName);

    const normalizedReleaseAlias = await db.query.bottleAliases.findFirst({
      where: and(
        eq(bottleAliases.name, bottle.fullName),
        eq(bottleAliases.releaseId, release.id),
      ),
    });
    expect(normalizedReleaseAlias).toBeUndefined();
  });

  test("updates an existing normalized review when a release alias later matches", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.LegacyBottle({
      name: "Calvados Cask Finished",
      vintageYear: null,
      releaseYear: null,
    });
    const existingReview = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: bottle.id,
      releaseId: null,
      name: bottle.fullName,
      issue: "Default",
      rating: 88,
      url: "https://example.com/original",
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      fullName: `${bottle.fullName} (2024 Release)`,
      name: `${bottle.name} (2024 Release)`,
      releaseYear: 2024,
    });
    const promotedBottle = await fixtures.Bottle({
      name: "Updated Calvados 2024 Promoted",
    });
    await recordCompletedPromotion(release.id, promotedBottle.id);
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.reviews.create(
      {
        site: site.type,
        name: release.fullName,
        issue: "Default",
        rating: 91,
        url: "https://example.com/2024-release",
        category: bottle.category,
      },
      { context: { user: adminUser } },
    );

    const review = await db.query.reviews.findFirst({
      where: (table, { eq }) => eq(table.id, existingReview.id),
    });
    expect(review).toBeDefined();
    expect(review?.id).toEqual(existingReview.id);
    expect(review?.releaseId).toEqual(release.id);
    expect(review?.name).toEqual(release.fullName);
    expect(review?.url).toEqual("https://example.com/2024-release");
    expect(data.id).toEqual(existingReview.id);

    const siteReviews = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.externalSiteId, site.id));
    expect(siteReviews).toHaveLength(1);
  });

  test("returns error for non-existent site", async ({ fixtures }) => {
    const adminUser = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.reviews.create(
        {
          site: "non-existent-site" as any, // force invalid type here
          name: "Bottle Name",
          issue: "Default",
          rating: 89,
          url: "https://example.com",
          category: "single_malt",
        },
        { context: { user: adminUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});
