import { faker } from "@faker-js/faker";
import type { BottleClassificationDecisionSchema } from "@peated/server/agents/bottleClassifier";
import { BottleClassificationResultSchema } from "@peated/server/agents/bottleClassifier/contract";
import { db } from "@peated/server/db";
import { bottles, tastingDrafts } from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import type { IdentifyBottlePhotoServices } from "@peated/server/lib/photoIdentification";
import {
  identifyTastingDraft,
  MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS,
  retryStaleTastingDraftIdentifications,
  STALE_TASTING_DRAFT_IDENTIFICATION_MS,
} from "@peated/server/lib/tastingDraftIdentification";
import waitError from "@peated/server/lib/test/waitError";
import { pushJob, pushUniqueJob } from "@peated/server/lib/test/workerDispatch";
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
  extractEvidence.mockImplementation(async ({ pendingUpload }) => ({
    extractedIdentity: null,
    imageEvidence: imageEvidence(pendingUpload.id),
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
      identificationAttempts: 1,
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
      identificationAttempts: 0,
      identification: null,
    });
  });

  test("marks the draft failed after its last attempt", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    runReference.mockRejectedValue(new Error("Classifier broke"));

    for (
      let attempt = 1;
      attempt <= MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS;
      attempt++
    ) {
      await expect(identifyTastingDraft(draft.id, services)).rejects.toThrow(
        "Classifier broke",
      );
      expect(await getDraft(draft.id)).toMatchObject({
        identificationAttempts: attempt,
        identificationStatus:
          attempt < MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS
            ? "pending"
            : "failed",
      });
    }

    runReference.mockClear();
    await identifyTastingDraft(draft.id, services);
    expect(runReference).not.toHaveBeenCalled();
  });

  test("does not use an attempt when the AI service is unavailable", async ({
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
      identificationAttempts: 0,
    });
  });

  test("waits without an attempt when the member is over the photo budget", async ({
    defaults,
    fixtures,
  }) => {
    const draft = await saveDraftWithPhoto(
      defaults.user,
      fixtures.SampleSquareImage,
    );
    // The member used the whole hourly budget on the photo route.
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
      identificationAttempts: 0,
    });
  });

  test("counts against the photo route's budget", async ({
    defaults,
    fixtures,
  }) => {
    const redis = await getConnection();
    // One identification left in the member's hourly budget.
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
          idempotencyKey: "after-draft-budget",
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

describe("retryStaleTastingDraftIdentifications", () => {
  test("queues stale pending drafts again and fails spent ones", async ({
    defaults,
    fixtures,
  }) => {
    const now = new Date();
    const stale = new Date(
      now.getTime() - STALE_TASTING_DRAFT_IDENTIFICATION_MS - 1000,
    );
    const pendingFields = {
      createdById: defaults.user.id,
      imageUrl: "/uploads/tasting-drafts/sweep.webp",
      identificationStatus: "pending" as const,
    };
    const lost = await fixtures.TastingDraft({
      ...pendingFields,
      identificationAttempts: 1,
      identificationQueuedAt: stale,
    });
    const spent = await fixtures.TastingDraft({
      ...pendingFields,
      identificationAttempts: MAX_TASTING_DRAFT_IDENTIFICATION_ATTEMPTS,
      identificationQueuedAt: stale,
    });
    const recent = await fixtures.TastingDraft({
      ...pendingFields,
      identificationQueuedAt: new Date(now.getTime() - 60_000),
    });
    const done = await fixtures.TastingDraft({
      ...pendingFields,
      identificationStatus: "done",
      identification: { action: "no_match" },
      identificationQueuedAt: stale,
    });

    const result = await retryStaleTastingDraftIdentifications({ now });

    expect(result).toEqual({ queued: 1, failed: 1 });
    expect(pushUniqueJob).toHaveBeenCalledTimes(1);
    expect(pushUniqueJob).toHaveBeenCalledWith("IdentifyTastingDraft", {
      draftId: lost.id,
    });
    expect(await getDraft(lost.id)).toMatchObject({
      identificationStatus: "pending",
      identificationQueuedAt: now,
    });
    expect(await getDraft(spent.id)).toMatchObject({
      identificationStatus: "failed",
    });
    expect(await getDraft(recent.id)).toMatchObject({
      identificationStatus: "pending",
      identificationQueuedAt: recent.identificationQueuedAt,
    });
    expect(await getDraft(done.id)).toMatchObject({
      identificationStatus: "done",
    });

    // A queued draft is not stale again until the threshold passes.
    pushUniqueJob.mockClear();
    await retryStaleTastingDraftIdentifications({ now });
    expect(pushUniqueJob).not.toHaveBeenCalled();
  });
});
