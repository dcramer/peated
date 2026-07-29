import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleAliases,
  bottleTombstones,
  incomingBottleDecisionLogs,
  reviews,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
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
  candidates: Array<{ bottleId: number }> = [],
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
      candidates,
      searchEvidence: [],
      resolvedEntities: [],
    },
  };
}

function buildCreateBottleDecision({
  brandName,
  bottleName,
}: {
  brandName: string;
  bottleName: string;
}) {
  return buildClassification({
    action: "create_bottle",
    proposedBottle: {
      name: bottleName,
      series: null,
      category: "single_malt",
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

async function findReviewByUrl(url: string) {
  return await db.query.reviews.findFirst({
    where: eq(reviews.url, url),
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
    const moderator = await fixtures.User({ mod: true });

    const error = await waitError(() =>
      routerClient.reviews.create(
        {
          site: site.type,
          name: "Unauthorized Review Bottle",
          issue: "Default",
          rating: 89,
          url: "https://example.com/reviews/unauthorized",
          category: "single_malt",
        },
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("stores an unresolved review without catalog identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const url = "https://example.com/reviews/unresolved";

    const result = await routerClient.reviews.create(
      {
        site: site.type,
        name: "Unresolved Review Bottle",
        issue: "Default",
        rating: 89,
        url,
        category: "single_malt",
      },
      { context: { user: admin } },
    );

    expect(await findReviewByUrl(url)).toMatchObject({
      id: result.id,
      bottleId: null,
      releaseId: null,
      name: "Unresolved Review Bottle",
      rating: 89,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Unresolved Review Bottle"),
      }),
    ).toBeUndefined();
  });

  test("writes an exact alias match directly to reviews.bottleId", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Exact Review Bottle",
    });
    const url = "https://example.com/reviews/exact-bottle";

    const result = await routerClient.reviews.create(
      {
        site: site.type,
        name: bottle.fullName,
        issue: "Default",
        rating: 91,
        url,
        category: bottle.category,
      },
      { context: { user: admin } },
    );

    expect(await findReviewByUrl(url)).toMatchObject({
      id: result.id,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(result.bottle).toMatchObject({ id: bottle.id });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("resolves an identity-preserving alias key before the classifier", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const bottle = await fixtures.Bottle({
      name: "10-year-old",
      brandId: brand.id,
    });
    const rawName = "Ardbeg 10 years old";
    expect(normalizeBottleAliasKey(rawName)).toBe(bottle.fullName);
    const url = "https://example.com/reviews/identity-preserving-alias";

    await routerClient.reviews.create(
      {
        site: site.type,
        name: rawName,
        issue: "Default",
        rating: 91,
        url,
        category: bottle.category,
      },
      { context: { user: admin } },
    );

    expect(await findReviewByUrl(url)).toMatchObject({
      bottleId: bottle.id,
      name: bottle.fullName,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("does not use a lossy display-normalized name as an exact alias", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Lagavulin" });
    const normalizedAliasBottle = await fixtures.Bottle({
      name: "Distillers Edition",
      brandId: brand.id,
    });
    const classifierBottle = await fixtures.Bottle({
      name: "Classifier Selected Expression",
      brandId: brand.id,
    });
    const rawName = "Lagavulin Distillers Edition 2011 Release";
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: classifierBottle.id,
          candidateBottleIds: [classifierBottle.id],
        },
        [{ bottleId: classifierBottle.id }],
      ),
    );
    const url = "https://example.com/reviews/lossy-display-normalization";

    await routerClient.reviews.create(
      {
        site: site.type,
        name: rawName,
        issue: "Default",
        rating: 92,
        url,
        category: classifierBottle.category,
      },
      { context: { user: admin } },
    );

    expect(normalizedAliasBottle.fullName).not.toBe(
      normalizeBottleAliasKey(rawName),
    );
    expect(await findReviewByUrl(url)).toMatchObject({
      bottleId: classifierBottle.id,
      name: normalizedAliasBottle.fullName,
    });
    expect(classifyBottleReferenceMock).toHaveBeenCalledOnce();
  });

  test("uses a directly assigned Bottle alias", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Direct Review Identity",
    });
    const aliasName = "Direct Review Alias";
    await fixtures.BottleAlias({
      name: aliasName,
      bottleId: bottle.id,
    });
    const url = "https://example.com/reviews/direct-alias";

    await routerClient.reviews.create(
      {
        site: site.type,
        name: aliasName,
        issue: "Default",
        rating: 92,
        url,
        category: bottle.category,
      },
      { context: { user: admin } },
    );

    expect(await findReviewByUrl(url)).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(aliasName)),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("stores a classifier match as direct Bottle identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Classifier Review Bottle",
    });
    const systemActor = await getPeatedSystemActor();
    const reviewName = "Classifier Review Match";
    const url = "https://example.com/reviews/classifier-match";
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
        },
        [{ bottleId: bottle.id }],
      ),
    );

    const result = await routerClient.reviews.create(
      {
        site: site.type,
        name: reviewName,
        issue: "Default",
        rating: 93,
        url,
        category: bottle.category,
      },
      { context: { user: admin } },
    );

    expect(await findReviewByUrl(url)).toMatchObject({
      id: result.id,
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
      assignmentSource: "classifier_approved",
      assignedByActorId: systemActor.id,
    });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "review"),
          eq(incomingBottleDecisionLogs.sourceId, result.id),
        ),
      }),
    ).toMatchObject({
      decision: "match_existing",
      bottleId: bottle.id,
      releaseId: null,
      createdBottle: false,
    });
  });

  test("creates one complete Bottle for an approved classifier decision", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Created Review Brand" });
    const url = "https://example.com/reviews/classifier-create";
    classifyBottleReferenceMock.mockResolvedValue(
      buildCreateBottleDecision({
        brandName: brand.name,
        bottleName: "Created Review Bottle",
      }),
    );

    const result = await routerClient.reviews.create(
      {
        site: site.type,
        name: `${brand.name} Created Review Bottle`,
        issue: "Default",
        rating: 94,
        url,
        category: "single_malt",
      },
      { context: { user: admin } },
    );

    const review = await findReviewByUrl(url);
    expect(review).toMatchObject({
      id: result.id,
      bottleId: expect.any(Number),
      releaseId: null,
    });
    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, review!.bottleId!),
      }),
    ).toMatchObject({
      id: review!.bottleId,
      brandId: brand.id,
      name: "Created Review Bottle",
      category: "single_malt",
      groupId: expect.any(Number),
    });
  });

  test("rejects missing Bottle assignments and rolls back the review write", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const missingBottleId = 2_147_483_647;
    const url = "https://example.com/reviews/missing-bottle";
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: missingBottleId,
          candidateBottleIds: [missingBottleId],
        },
        [{ bottleId: missingBottleId }],
      ),
    );

    const error = await waitError(() =>
      routerClient.reviews.create(
        {
          site: site.type,
          name: "Missing Review Bottle",
          issue: "Default",
          rating: 89,
          url,
          category: "single_malt",
        },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchObject({
      code: "NOT_FOUND",
      status: 404,
      message: "Bottle not found.",
      cause: expect.objectContaining({
        name: "ActiveBottleSelectionError",
        reason: "missing",
        bottleId: missingBottleId,
      }),
    });
    expect(await findReviewByUrl(url)).toBeUndefined();
  });

  test("rejects every inactive Bottle state and rolls back the review write", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const unassigned = await fixtures.LegacyBottle({
      name: "Unassigned Review Bottle",
    });
    const retired = await fixtures.Bottle({
      name: "Retired Review Bottle",
    });
    const replacement = await fixtures.Bottle({
      name: "Review Tombstone Replacement",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    for (const [bottle, reason] of [
      [unassigned, "unassigned"],
      [retired, "bottle_retired"],
    ] as const) {
      const url = `https://example.com/reviews/${reason}`;
      const error = await waitError(() =>
        routerClient.reviews.create(
          {
            site: site.type,
            name: bottle.fullName,
            issue: "Default",
            rating: 89,
            url,
            category: bottle.category,
          },
          { context: { user: admin } },
        ),
      );

      expect(error).toMatchObject({
        code: "CONFLICT",
        status: 409,
        message:
          reason === "bottle_retired"
            ? `Bottle ${bottle.id} is retired.`
            : `Bottle ${bottle.id} is not active.`,
        cause: expect.objectContaining({
          name: "ActiveBottleSelectionError",
          reason,
          bottleId: bottle.id,
        }),
      });
      expect(await findReviewByUrl(url)).toBeUndefined();
    }
  });

  test("rolls back the Review when a later alias claim fails", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const selectedBottle = await fixtures.Bottle({
      name: "Rollback Destination Bottle",
    });
    const conflictingBottle = await fixtures.Bottle({
      name: "Rollback Alias Owner",
    });
    const reviewName = "Rollback Review Assignment";
    const retryUrl = "https://example.com/reviews/rollback-retry";
    classifyBottleReferenceMock.mockImplementationOnce(async () => {
      await fixtures.BottleAlias({
        name: normalizeBottleAliasKey(reviewName),
        bottleId: conflictingBottle.id,
      });
      return buildClassification(
        {
          action: "match",
          matchedBottleId: selectedBottle.id,
          candidateBottleIds: [selectedBottle.id],
        },
        [{ bottleId: selectedBottle.id }],
      );
    });

    await expect(
      routerClient.reviews.create(
        {
          site: site.type,
          name: reviewName,
          issue: "Default",
          rating: 99,
          url: retryUrl,
          category: selectedBottle.category,
        },
        { context: { user: admin } },
      ),
    ).rejects.toThrow();

    expect(await findReviewByUrl(retryUrl)).toBeUndefined();
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, normalizeBottleAliasKey(reviewName)),
      }),
    ).toMatchObject({
      bottleId: conflictingBottle.id,
    });
  });

  test("a concurrent insert preserves its committed Bottle identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const committedBottle = await fixtures.Bottle({
      name: "Concurrent Committed Bottle",
    });
    const incomingBottle = await fixtures.Bottle({
      name: "Concurrent Incoming Bottle",
    });
    const reviewName = "Concurrent Review Assignment";
    const issue = "Default";
    const resultUrl = "https://example.com/reviews/concurrent-result";
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let creation: ReturnType<typeof routerClient.reviews.create> | undefined;
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: incomingBottle.id,
          candidateBottleIds: [incomingBottle.id],
        },
        [{ bottleId: incomingBottle.id }],
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
          ("bottle_id", "external_site_id", "name", "issue", "rating", "url")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          committedBottle.id,
          site.id,
          reviewName,
          issue,
          82,
          "https://example.com/reviews/concurrent-holder",
        ],
      );

      creation = routerClient.reviews.create(
        {
          site: site.type,
          name: reviewName,
          issue,
          rating: 96,
          url: resultUrl,
          category: incomingBottle.category,
        },
        { context: { user: admin } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      const result = await creation;
      expect(await findReviewByUrl(resultUrl)).toMatchObject({
        id: result.id,
        bottleId: committedBottle.id,
        releaseId: null,
        rating: 96,
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
            eq(incomingBottleDecisionLogs.sourceId, result.id),
          ),
        }),
      ).toBeUndefined();
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await creation?.catch(() => undefined);
    }
  });

  test("an unresolved retry preserves an existing direct Bottle assignment", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle({
      name: "Durable Review Bottle",
    });
    const reviewName = "Durable Unresolved Review";
    const existing = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: bottle.id,
      releaseId: null,
      name: reviewName,
      url: "https://example.com/reviews/durable-original",
    });

    const result = await routerClient.reviews.create(
      {
        site: site.type,
        name: reviewName,
        issue: existing.issue,
        rating: 97,
        url: "https://example.com/reviews/durable-retry",
        category: bottle.category,
      },
      { context: { user: admin } },
    );

    expect(
      await findReviewByUrl("https://example.com/reviews/durable-retry"),
    ).toMatchObject({
      id: result.id,
      bottleId: bottle.id,
      releaseId: null,
      rating: 97,
    });
  });

  test("a conflicting resolved retry preserves a different durable Bottle", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const admin = await fixtures.User({ admin: true });
    const durableBottle = await fixtures.Bottle({
      name: "Durable Conflict Bottle",
    });
    const incomingBottle = await fixtures.Bottle({
      name: "Incoming Conflict Bottle",
    });
    const aliasName = "Conflicting Resolved Review";
    await fixtures.BottleAlias({
      name: aliasName,
      bottleId: incomingBottle.id,
    });
    const existing = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: durableBottle.id,
      releaseId: null,
      name: aliasName,
      url: "https://example.com/reviews/conflict-original",
    });

    const result = await routerClient.reviews.create(
      {
        site: site.type,
        name: aliasName,
        issue: existing.issue,
        rating: 98,
        url: "https://example.com/reviews/conflict-retry",
        category: incomingBottle.category,
      },
      { context: { user: admin } },
    );

    expect(
      await findReviewByUrl("https://example.com/reviews/conflict-retry"),
    ).toMatchObject({
      id: result.id,
      bottleId: durableBottle.id,
      releaseId: null,
      rating: 98,
    });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: and(
          eq(incomingBottleDecisionLogs.sourceKind, "review"),
          eq(incomingBottleDecisionLogs.sourceId, existing.id),
        ),
      }),
    ).toBeUndefined();
  });

  test("rejects invalid site input", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    const error = await waitError(() =>
      routerClient.reviews.create(
        {
          site: "not-a-site" as never,
          name: "Invalid Site Review",
          issue: "Default",
          rating: 89,
          url: "https://example.com/reviews/invalid-site",
          category: "single_malt",
        },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});
