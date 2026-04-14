import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import createMissingBottles from "@peated/server/worker/jobs/createMissingBottles";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());
const pushJobMock = vi.hoisted(() => vi.fn());
const pushUniqueJobMock = vi.hoisted(() => vi.fn());
const getAutomationModeratorUserMock = vi.hoisted(() => vi.fn());

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

vi.mock("@peated/server/lib/systemUser", () => ({
  getAutomationModeratorUser: getAutomationModeratorUserMock,
}));

function buildClassification(decision: Record<string, unknown>) {
  return {
    status: "classified" as const,
    decision: {
      confidence: 0.9,
      rationale: "test fixture",
      candidateBottleIds: [],
      ...decision,
    },
    artifacts: {
      extractedIdentity: null,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
    },
  };
}

describe("createMissingBottles", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    pushJobMock.mockReset();
    pushUniqueJobMock.mockReset();
    getAutomationModeratorUserMock.mockReset();
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );
  });

  test("uses the classifier to create bottles for unmatched reviews", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({
      admin: true,
      username: "dcramer",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: "Springbank Bottle Name",
      issue: "Default",
      url: "https://example.com/review",
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: review.name,
    });

    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle",
        proposedBottle: {
          name: "Bottle Name",
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
            name: "Springbank",
          },
          distillers: [],
          bottler: null,
        },
      }),
    );

    await createMissingBottles();

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(updatedReview?.bottleId).toBeTruthy();
    expect(updatedReview?.releaseId).toBeNull();

    const bottle = await db.query.bottles.findFirst({
      where: (table, { eq }) => eq(table.id, updatedReview!.bottleId as number),
    });
    expect(bottle?.fullName).toEqual("Springbank Bottle Name");

    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, review.name),
    });
    expect(alias?.bottleId).toEqual(updatedReview?.bottleId);

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    expect(updatedPrice?.bottleId).toEqual(updatedReview?.bottleId);
    expect(pushUniqueJobMock).toHaveBeenCalledWith("IndexBottleSearchVectors", {
      bottleId: updatedReview?.bottleId,
    });
  });

  test("only visits unresolved reviews once per run", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    const systemUser = await fixtures.User({
      admin: true,
      username: "dcramer",
    });
    getAutomationModeratorUserMock.mockResolvedValue(systemUser);
    const review = await fixtures.Review({
      externalSiteId: site.id,
      bottleId: null,
      releaseId: null,
      name: "Unknown Review Title",
      issue: "Default",
      url: "https://example.com/unresolved-review",
    });

    await createMissingBottles();

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);

    const unchangedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });
    expect(unchangedReview?.bottleId).toBeNull();
    expect(unchangedReview?.releaseId).toBeNull();
  });
});
