import { faker } from "@faker-js/faker";
import { BottleClassificationDecisionSchema } from "@peated/server/agents/bottleClassifier";
import { db } from "@peated/server/db";
import { bottleImages, bottles, tastingDrafts } from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import type { Context } from "@peated/server/orpc/context";
import { routerClient } from "@peated/server/orpc/router";
import type { StoredTastingDraftIdentification } from "@peated/server/schemas";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

type User = NonNullable<Context["user"]>;

function createProposal(
  brandName: string,
  bottleName: string,
  suitableAsBottleImage = true,
): StoredTastingDraftIdentification {
  const decision = BottleClassificationDecisionSchema.parse({
    action: "create_bottle",
    rationale: "Reliable photo evidence supports creating the bottle.",
    candidateBottleIds: [],
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
      brand: { id: null, name: brandName },
      distillers: [{ id: null, name: brandName }],
      bottler: null,
    },
  });
  if (decision.action !== "create_bottle") throw new Error("unreachable");
  return {
    action: "create_bottle",
    decision,
    photoSuitability: {
      isSingleBottlePhoto: true,
      labelReadable: true,
      suitableAsTastingImage: true,
      suitableAsBottleImage,
    },
  };
}

/** A draft with a real photo whose identification already finished. */
async function identifiedDraft(
  user: User,
  sampleImage: () => Promise<File>,
  identification: StoredTastingDraftIdentification,
) {
  const draftId = faker.string.uuid();
  const upload = await createPendingImageUpload({
    file: await sampleImage(),
    createdById: user.id,
    purpose: "photo_tasting_entry",
  });
  await routerClient.tastingDrafts.upsert(
    {
      draft: draftId,
      tastedAt: new Date().toISOString(),
      pendingImageId: upload.id,
    },
    { context: { user } },
  );
  const [draft] = await db
    .update(tastingDrafts)
    .set({ identificationStatus: "done", identification })
    .where(eq(tastingDrafts.id, draftId))
    .returning();
  return draft;
}

describe("POST /tasting-drafts/{draft}/create-bottle", () => {
  test("requires a verified member", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });
    const draft = await identifiedDraft(
      user,
      fixtures.SampleSquareImage,
      createProposal("Unverified Draft Distillery", "Unverified Draft"),
    );

    const error = await waitError(
      routerClient.tastingDrafts.createBottle(
        { draft: draft.id },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({ status: 401 });
  });

  test("requires accepted terms", async ({ fixtures }) => {
    const user = await fixtures.User({ termsAcceptedAt: null });
    const draft = await fixtures.TastingDraft({ createdById: user.id });

    const error = await waitError(
      routerClient.tastingDrafts.createBottle(
        { draft: draft.id },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({ status: 403 });
  });

  test("returns not found for another member's draft", async ({
    defaults,
    fixtures,
  }) => {
    const owner = await fixtures.User();
    const draft = await identifiedDraft(
      owner,
      fixtures.SampleSquareImage,
      createProposal("Foreign Draft Distillery", "Foreign Draft"),
    );
    const bottlesBefore = await db.select({ id: bottles.id }).from(bottles);

    const error = await waitError(
      routerClient.tastingDrafts.createBottle(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 404 });
    expect(await db.select({ id: bottles.id }).from(bottles)).toHaveLength(
      bottlesBefore.length,
    );
  });

  test("rejects a draft without a new Bottle proposal", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await identifiedDraft(
      defaults.user,
      fixtures.SampleSquareImage,
      { action: "no_match" },
    );

    const error = await waitError(
      routerClient.tastingDrafts.createBottle(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      status: 400,
      message: "This draft has no new Bottle to confirm.",
    });
  });

  test("rejects a proposal that now needs review", async ({
    defaults,
    fixtures,
  }) => {
    const proposal = createProposal("Review Draft Distillery", "Review Draft");
    if (proposal.action !== "create_bottle") throw new Error("unreachable");
    proposal.decision.confidenceBasis = {
      unresolvedRisks: [{ category: "release_ambiguity", note: "Two fit." }],
      webEvidence: "weak",
    };
    const draft = await identifiedDraft(
      defaults.user,
      fixtures.SampleSquareImage,
      proposal,
    );

    const error = await waitError(
      routerClient.tastingDrafts.createBottle(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 400 });
    expect(
      await db.query.tastingDrafts.findFirst({
        where: eq(tastingDrafts.id, draft.id),
      }),
    ).toMatchObject({ bottleId: null });
  });

  test("creates the Bottle, chooses it, and returns the same Bottle on retry", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await identifiedDraft(
      defaults.user,
      fixtures.SampleSquareImage,
      createProposal("Draft Create Distillery", "Draft Create Expression"),
    );

    const first = await routerClient.tastingDrafts.createBottle(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );
    const bottleId = first.draft.bottle!.id;
    const bottlesAfterFirst = await db.select({ id: bottles.id }).from(bottles);

    expect(first.warnings).toBeUndefined();
    expect(first.draft).toMatchObject({
      id: draft.id,
      bottle: { name: "Draft Create Expression" },
    });
    const stored = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottleId),
    });
    // The suitable photo becomes the new Bottle's public image, under a name
    // that does not reveal the draft.
    expect(stored?.imageUrl).toMatch(
      new RegExp(`^/uploads/bottles/bottle-${bottleId}-`),
    );
    expect(stored?.imageUrl).not.toContain(draft.id);
    await expect(
      db.query.bottleImages.findFirst({
        where: eq(bottleImages.bottleId, bottleId),
      }),
    ).resolves.toMatchObject({ imageUrl: stored?.imageUrl, isPrimary: true });

    const retry = await routerClient.tastingDrafts.createBottle(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );

    expect(retry.draft.bottle?.id).toBe(bottleId);
    expect(await db.select({ id: bottles.id }).from(bottles)).toHaveLength(
      bottlesAfterFirst.length,
    );
    expect(
      await db.query.tastingDrafts.findFirst({
        where: eq(tastingDrafts.id, draft.id),
      }),
    ).toMatchObject({ bottleId });
  });

  test("keeps the photo private when it is not suitable for the catalog", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await identifiedDraft(
      defaults.user,
      fixtures.SampleSquareImage,
      createProposal("Private Photo Distillery", "Private Photo", false),
    );

    const result = await routerClient.tastingDrafts.createBottle(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );

    expect(result.draft.bottle).toMatchObject({ imageUrl: null });
  });

  test("returns the existing Bottle as a conflict", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Draft Conflict Distillery",
      kind: "distillery",
    });
    const existing = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [brand.id],
      name: "Conflict Expression",
      category: "single_malt",
    });
    // Same identity, but not written the same way, so it is not reused.
    const draft = await identifiedDraft(
      defaults.user,
      fixtures.SampleSquareImage,
      createProposal(brand.name, "CONFLICT EXPRESSION"),
    );

    const error = await waitError(
      routerClient.tastingDrafts.createBottle(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      status: 409,
      data: { bottle: existing.id },
    });
    expect(
      await db.query.tastingDrafts.findFirst({
        where: eq(tastingDrafts.id, draft.id),
      }),
    ).toMatchObject({ bottleId: null });
  });
});
