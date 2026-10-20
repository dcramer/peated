import { faker } from "@faker-js/faker";
import type { BottleClassificationDecisionSchema } from "@peated/server/agents/bottleClassifier";
import { BottleClassificationResultSchema } from "@peated/server/agents/bottleClassifier/contract";
import { db } from "@peated/server/db";
import { bottles, tastingDrafts } from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import type { IdentifyBottlePhotoServices } from "@peated/server/lib/photoIdentification";
import { identifyTastingDraft } from "@peated/server/lib/tastingDraftIdentification";
import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import type { Context } from "@peated/server/orpc/context";
import { routerClient } from "@peated/server/orpc/router";
import { getConnection } from "@peated/server/worker/redis";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { z } from "zod";

type User = NonNullable<Context["user"]>;

const extractEvidence = vi.fn<IdentifyBottlePhotoServices["extractEvidence"]>();
const runReference = vi.fn<IdentifyBottlePhotoServices["runReference"]>();
const services: IdentifyBottlePhotoServices = {
  extractEvidence,
  runReference,
  startSpan: async (_context, callback) =>
    await callback({ setAttribute() {} }),
};

function imageEvidence(sourceImageId: string) {
  return {
    sourceImageId,
    extractors: [
      {
        kind: "vision" as const,
        model: "test-vision",
        confidence: 0.9,
        textSpans: [{ text: "Draft Test Label", confidence: 0.9 }],
        observations: ["Readable front label."],
      },
    ],
    fieldCandidates: {},
    photoSuitability: {
      isSingleBottlePhoto: true,
      labelReadable: true,
      suitableAsTastingImage: true,
      suitableAsBottleImage: true,
    },
    conflicts: [],
  };
}

function classified(
  decision: Omit<
    z.input<typeof BottleClassificationDecisionSchema>,
    "rationale" | "candidateBottleIds"
  >,
) {
  return {
    result: BottleClassificationResultSchema.parse({
      status: "classified",
      decision: {
        rationale: "test fixture",
        candidateBottleIds: [],
        ...decision,
      },
      artifacts: {
        extractedIdentity: null,
        imageEvidence: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
      },
    }),
    modelMetadata: null,
  };
}

function matchDecision(bottleId: number) {
  return {
    action: "match" as const,
    matchedBottleId: bottleId,
    candidateBottleIds: [bottleId],
    identityScope: "product" as const,
    confidenceBasis: {
      unresolvedRisks: [],
      webEvidence: "not_needed" as const,
    },
  };
}

const createDecision = {
  action: "create_bottle" as const,
  proposedBottle: {
    name: "Draft Proposal",
    series: null,
    category: "single_malt" as const,
    edition: null,
    statedAge: null,
    caskStrength: null,
    singleCask: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    brand: { id: null, name: "Draft Proposal Distillery" },
    distillers: [{ id: null, name: "Draft Proposal Distillery" }],
    bottler: null,
  },
};

async function saveDraftWithPhoto(
  user: User,
  sampleImage: () => Promise<File>,
  draftId: string = faker.string.uuid(),
) {
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
  return await getDraft(draftId);
}

async function getDraft(id: string) {
  const draft = await db.query.tastingDrafts.findFirst({
    where: eq(tastingDrafts.id, id),
  });
  if (!draft) throw new Error("Draft not found");
  return draft;
}

beforeEach(() => {
  extractEvidence.mockReset();
  extractEvidence.mockImplementation(async ({ photo }) => ({
    extractedIdentity: null,
    imageEvidence: imageEvidence(photo.id),
  }));
  runReference.mockReset();
});

describe("identifyTastingDraft", () => {
  test("saves a match for the member to confirm without choosing it", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockResolvedValue(classified(matchDecision(bottle.id)));

    await identifyTastingDraft(draft.id, services);

    expect(await getDraft(draft.id)).toMatchObject({
      bottleId: null,
      identificationStatus: "done",
      identification: { action: "match", bottleId: bottle.id },
    });
    const serialized = await routerClient.tastingDrafts.details(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );
    expect(serialized.bottle).toBeNull();
    expect(serialized.identification).toMatchObject({
      status: "done",
      result: { action: "match", bottle: { id: bottle.id } },
    });
  });

  test("saves a new Bottle proposal without creating it", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockResolvedValue(classified(createDecision));
    const bottlesBefore = await db.select({ id: bottles.id }).from(bottles);

    await identifyTastingDraft(draft.id, services);

    expect(await getDraft(draft.id)).toMatchObject({
      bottleId: null,
      identificationStatus: "done",
      identification: {
        action: "create_bottle",
        decision: { action: "create_bottle" },
        photoSuitability: { suitableAsBottleImage: true },
      },
    });
    expect(await db.select({ id: bottles.id }).from(bottles)).toHaveLength(
      bottlesBefore.length,
    );
    const serialized = await routerClient.tastingDrafts.details(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );
    expect(serialized.identification).toEqual({
      status: "done",
      result: {
        action: "create_bottle",
        proposedBottle: expect.objectContaining({
          name: "Draft Proposal",
          brand: { id: null, name: "Draft Proposal Distillery" },
        }),
      },
    });
  });

  test("saves no_match when the result needs review", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockResolvedValue(
      classified({
        ...createDecision,
        confidenceBasis: {
          unresolvedRisks: [
            { category: "release_ambiguity", note: "Two releases fit." },
          ],
          webEvidence: "weak",
        },
      }),
    );

    await identifyTastingDraft(draft.id, services);

    expect(await getDraft(draft.id)).toMatchObject({
      identificationStatus: "done",
      identification: { action: "no_match" },
    });
  });

  test("ignores a result for a photo that was replaced while it ran", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockImplementation(async () => {
      // The member saves a new photo before identification finishes.
      await saveDraftWithPhoto(
        defaults.user,
        fixtures.SampleSquareImage,
        draft.id,
      );
      return classified(matchDecision(bottle.id));
    });

    await identifyTastingDraft(draft.id, services);

    const after = await getDraft(draft.id);
    expect(after.imageUrl).not.toEqual(draft.imageUrl);
    expect(after).toMatchObject({
      identificationStatus: "pending",
      identification: null,
    });
  });

  test("marks the draft failed when identification breaks", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockRejectedValue(new Error("Classifier broke"));

    await expect(identifyTastingDraft(draft.id, services)).rejects.toThrow(
      "Classifier broke",
    );

    expect(await getDraft(draft.id)).toMatchObject({
      identificationStatus: "failed",
      identification: null,
    });
    // A failed draft is not tried again.
    runReference.mockClear();
    await identifyTastingDraft(draft.id, services);
    expect(runReference).not.toHaveBeenCalled();
  });

  test("stays pending when the AI service is unavailable", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockRejectedValue(
      new Error("Classification failed", {
        cause: new OpenAI.APIError(503, {}, "Unavailable", new Headers()),
      }),
    );

    const error = await waitError(identifyTastingDraft(draft.id, services));

    expect(error).toMatchObject({ message: "Classification failed" });
    expect(await getDraft(draft.id)).toMatchObject({
      identificationStatus: "pending",
    });
  });

  test("waits when the member is over the photo identification limit", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    // The member used the whole hourly limit on the photo route.
    const redis = await getConnection();
    await redis.set(
      `photo-identification:${defaults.user.id}`,
      30,
      "PX",
      10 * 60 * 1000,
    );
    pushJob.mockClear();

    await identifyTastingDraft(draft.id, services);

    expect(extractEvidence).not.toHaveBeenCalled();
    expect(pushJob).toHaveBeenCalledWith(
      "IdentifyTastingDraft",
      { draftId: draft.id },
      { delay: expect.any(Number) },
    );
    const delay = pushJob.mock.calls[0][2]!.delay!;
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(await getDraft(draft.id)).toMatchObject({
      identificationStatus: "pending",
    });
  });

  test("counts against the photo route's limit", async ({
    defaults,
    fixtures,
  }) => {
    const redis = await getConnection();
    // One identification left in the member's hourly limit.
    await redis.set(
      `photo-identification:${defaults.user.id}`,
      29,
      "PX",
      60_000,
    );
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockResolvedValue(classified({ action: "no_match" }));

    await identifyTastingDraft(draft.id, services);

    expect(await getDraft(draft.id)).toMatchObject({
      identificationStatus: "done",
    });
    const error = await waitError(
      routerClient.tastings.photoIdentification(
        {
          file: await fixtures.SampleSquareImage(),
          idempotencyKey: "after-draft-limit",
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Too many requests. Please try again later.",
    });
  });
});
