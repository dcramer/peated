import { db } from "@peated/server/db";
import { bottleAliases, reviews } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
  });

  test("new review with classifier-backed bottle creation", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const brand = await fixtures.Entity({ name: "Springbank" });
    const adminUser = await fixtures.User({ admin: true });

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
    expect(bottle).toBeDefined();
    expect(bottle?.fullName).toEqual(`${brand.name} Bottle Name`);
    expect(bottle?.name).toEqual("Bottle Name");
    expect(bottle?.category).toEqual("single_malt");
    expect(bottle?.brandId).toEqual(brand.id);
    expect(pushUniqueJobMock).toHaveBeenCalledWith("IndexBottleSearchVectors", {
      bottleId: bottle!.id,
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

  test("new review can create a release under a classifier-selected parent", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
      name: "Distillers Edition",
      vintageYear: null,
      releaseYear: null,
    });
    const adminUser = await fixtures.User({ admin: true });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "create_release",
          parentBottleId: bottle.id,
          proposedRelease: {
            edition: "2011 Release",
            statedAge: null,
            abv: null,
            caskStrength: null,
            singleCask: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            description: null,
            tastingNotes: null,
            imageUrl: null,
          },
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
        name: `${bottle.fullName} 2011 Release`,
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
    expect(review?.releaseId).toBeTruthy();

    const release = await db.query.bottleReleases.findFirst({
      where: (table, { eq }) => eq(table.id, review!.releaseId as number),
    });
    expect(release?.bottleId).toEqual(bottle.id);
    expect(release?.edition).toEqual("2011 Release");
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
    expect(review).toBeDefined();
    expect(review?.bottleId).toEqual(bottle.id);
    expect(review?.name).toEqual(bottle.fullName);
    expect(review?.issue).toEqual("Default");
    expect(review?.rating).toEqual(89);
    expect(review?.url).toEqual("https://example.com");
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
  });

  test("new review with existing release", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
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
    expect(review).toBeDefined();
    expect(review?.bottleId).toEqual(bottle.id);
    expect(review?.releaseId).toEqual(release.id);
    expect(data.bottle?.id).toEqual(bottle.id);
    expect(data.release?.id).toEqual(release.id);
  });

  test("preserves raw release alias text when normalization would strip release identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const bottle = await fixtures.Bottle({
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
    const bottle = await fixtures.Bottle({
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
    const bottle = await fixtures.Bottle({
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
