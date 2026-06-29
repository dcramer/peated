import { BottleClassificationResultSchema } from "@peated/server/agents/bottleClassifier/contract";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  pendingUploads,
  tastings,
} from "@peated/server/db/schema";
import type * as photoIdentificationModule from "@peated/server/lib/photoIdentification";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());
const extractPhotoBottleEvidenceMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);

vi.mock("@peated/server/lib/photoIdentification", async () => {
  const actual = await vi.importActual<typeof photoIdentificationModule>(
    "@peated/server/lib/photoIdentification",
  );

  return {
    ...actual,
    extractPhotoBottleEvidence: extractPhotoBottleEvidenceMock,
    withPhotoIdentificationTimeout: <T>(work: Promise<T>, fallback: () => T) =>
      actual.withPhotoIdentificationTimeout(work, fallback, 10),
  };
});

function buildImageEvidence(sourceImageId: string) {
  return {
    sourceImageId,
    extractors: [
      {
        kind: "vision" as const,
        model: "test-vision",
        confidence: 0.9,
        textSpans: [{ text: "Ardbeg Uigeadail", confidence: 0.9 }],
        observations: ["Readable Ardbeg Uigeadail front label."],
      },
    ],
    fieldCandidates: {
      brand: {
        value: "Ardbeg",
        confidence: 0.9,
        sourceExtractorIndexes: [0],
      },
      expression: {
        value: "Uigeadail",
        confidence: 0.9,
        sourceExtractorIndexes: [0],
      },
    },
    photoSuitability: {
      isSingleBottlePhoto: true,
      labelReadable: true,
      suitableAsTastingImage: true,
      suitableAsBottleImage: true,
    },
    conflicts: [],
  };
}

function buildClassification(
  decision: Record<string, unknown>,
  artifacts: Record<string, unknown> = {},
) {
  return BottleClassificationResultSchema.parse({
    status: "classified" as const,
    decision: {
      confidence: 90,
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
      ...artifacts,
    },
  });
}

async function countRows() {
  const [bottleRows, releaseRows, tastingRows] = await Promise.all([
    db.select({ id: bottles.id }).from(bottles),
    db.select({ id: bottleReleases.id }).from(bottleReleases),
    db.select({ id: tastings.id }).from(tastings),
  ]);

  return {
    bottles: bottleRows.length,
    releases: releaseRows.length,
    tastings: tastingRows.length,
  };
}

describe("POST /tastings/photo-identification", () => {
  beforeEach(() => {
    classifyBottleReferenceMock.mockReset();
    extractPhotoBottleEvidenceMock.mockReset();
  });

  test("requires authentication", async ({ fixtures }) => {
    const err = await waitError(
      routerClient.tastings.photoIdentification({
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "requires-authentication",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns pending image, evidence, classification, and next step", async ({
    fixtures,
    defaults,
  }) => {
    const before = await countRows();
    const matchedBottle = await fixtures.Bottle({
      fullName: "Ardbeg Uigeadail",
    });

    extractPhotoBottleEvidenceMock.mockImplementation(
      async ({ pendingUpload }) => ({
        extractedIdentity: {
          brand: "Ardbeg",
          bottler: null,
          expression: "Uigeadail",
          series: null,
          distillery: null,
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        imageEvidence: buildImageEvidence(pendingUpload.id),
      }),
    );
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: matchedBottle.id,
          matchedReleaseId: null,
        },
        {
          candidates: [
            {
              kind: "bottle",
              bottleId: matchedBottle.id,
              releaseId: null,
              fullName: "Ardbeg Uigeadail",
              bottleFullName: "Ardbeg Uigeadail",
              brand: "Ardbeg",
              score: 0.98,
              source: ["exact"],
            },
          ],
          searchEvidence: [
            {
              query: "Ardbeg Uigeadail",
              results: [],
            },
          ],
        },
      ),
    );

    const response = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-success",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.pendingImage.id).toBeDefined();
    expect(response.pendingImage.imageUrl).toContain(
      "/uploads/pending-uploads/",
    );
    expect(response.imageEvidence.sourceImageId).toBe(response.pendingImage.id);
    expect(response.classification.status).toBe("classified");
    expect(response.suggestedNextStep).toBe("confirm_match");
    expect(response.classification).toMatchObject({
      decision: {
        action: "match",
        matchedBottleId: matchedBottle.id,
        matchedReleaseId: null,
      },
      artifacts: {
        candidates: [
          {
            bottleId: matchedBottle.id,
            releaseId: null,
            bottleFullName: "Ardbeg Uigeadail",
            fullName: "Ardbeg Uigeadail",
          },
        ],
      },
    });
    expect(response.classification.artifacts).toEqual({
      candidates: [
        {
          bottleId: matchedBottle.id,
          releaseId: null,
          bottleFullName: "Ardbeg Uigeadail",
          fullName: "Ardbeg Uigeadail",
        },
      ],
    });

    expect(classifyBottleReferenceMock).toHaveBeenCalledWith({
      reference: {
        id: response.pendingImage.id,
        name: "Ardbeg Uigeadail",
        url: null,
        imageUrl: response.pendingImage.imageUrl,
      },
      extractedIdentity: expect.objectContaining({
        brand: "Ardbeg",
        expression: "Uigeadail",
      }),
      imageEvidence: expect.objectContaining({
        sourceImageId: response.pendingImage.id,
      }),
    });

    const after = await countRows();
    expect(after).toEqual({
      bottles: before.bottles + 1,
      releases: before.releases,
      tastings: before.tastings,
    });
  });

  test("reuses pending upload for idempotent retries", async ({
    fixtures,
    defaults,
  }) => {
    extractPhotoBottleEvidenceMock.mockImplementation(
      async ({ pendingUpload }) => ({
        extractedIdentity: null,
        imageEvidence: buildImageEvidence(pendingUpload.id),
      }),
    );
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );

    const first = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-retry",
      },
      {
        context: { user: defaults.user },
      },
    );
    const second = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-retry",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(second.pendingImage.id).toBe(first.pendingImage.id);

    const rows = await db
      .select()
      .from(pendingUploads)
      .where(eq(pendingUploads.createdById, defaults.user.id));
    expect(rows).toHaveLength(1);
  });

  test("rejects oversized upload before extraction or classification", async ({
    defaults,
  }) => {
    const err = await waitError(
      routerClient.tastings.photoIdentification(
        {
          file: new Blob([new Uint8Array(MAX_FILESIZE + 1)]),
          idempotencyKey: "photo-identification-oversized",
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: File exceeded maximum upload size of 20.0 MiB.]`,
    );
    expect(extractPhotoBottleEvidenceMock).not.toHaveBeenCalled();
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("falls back to manual search when classifier does not match", async ({
    fixtures,
    defaults,
  }) => {
    extractPhotoBottleEvidenceMock.mockImplementation(
      async ({ pendingUpload }) => ({
        extractedIdentity: null,
        imageEvidence: buildImageEvidence(pendingUpload.id),
      }),
    );
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({ action: "no_match" }),
    );

    const response = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-manual-search",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.suggestedNextStep).toBe("manual_search");
  });

  test("returns pending image with manual search fallback when extraction fails", async ({
    fixtures,
    defaults,
  }) => {
    extractPhotoBottleEvidenceMock.mockRejectedValue(
      new Error("vision provider unavailable"),
    );

    const response = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-extraction-failure",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.pendingImage.id).toBeDefined();
    expect(response.suggestedNextStep).toBe("manual_search");
    expect(response.classification).toMatchObject({
      status: "ignored",
      reason: "Photo identification could not produce a reviewed bottle match.",
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("returns pending image with manual search fallback when identification times out", async ({
    fixtures,
    defaults,
  }) => {
    extractPhotoBottleEvidenceMock.mockImplementation(
      () => new Promise(() => undefined),
    );

    const response = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-timeout",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.pendingImage.id).toBeDefined();
    expect(response.suggestedNextStep).toBe("manual_search");
    expect(response.classification).toMatchObject({
      status: "ignored",
      reason:
        "Photo identification timed out before a reviewed bottle match was available.",
    });
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  }, 15_000);

  test("creates bottle and release from a reviewed photo identification proposal", async ({
    defaults,
    fixtures,
  }) => {
    extractPhotoBottleEvidenceMock.mockImplementation(
      async ({ pendingUpload }) => ({
        extractedIdentity: {
          brand: "Pōkeno Photo Test",
          expression: "Totara Cask",
          series: "Exploration Series",
          distillery: "Pōkeno Photo Test",
          bottler: null,
          category: "single_malt",
          stated_age: null,
          abv: 43,
          vintage_year: null,
          release_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: "Exploration Series No. 1",
        },
        imageEvidence: buildImageEvidence(pendingUpload.id),
      }),
    );
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification({
        action: "create_bottle_and_release",
        confidence: 91,
        rationale: "Reliable web evidence supports the product identity.",
        proposedBottle: {
          name: "Totara Cask",
          series: {
            id: null,
            name: "Exploration Series",
          },
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
            name: "Pōkeno Photo Test",
          },
          distillers: [
            {
              id: null,
              name: "Pōkeno Photo Test",
            },
          ],
          bottler: null,
        },
        proposedRelease: {
          edition: "Exploration Series No. 1",
          statedAge: null,
          abv: 43,
          caskStrength: null,
          singleCask: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
        },
      }),
    );

    const identification = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-create",
      },
      {
        context: { user: defaults.user },
      },
    );

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.bottle.fullName).toBe("Pōkeno Photo Test Totara Cask");
    expect(response.release).toMatchObject({
      bottleId: response.bottle.id,
      edition: "Exploration Series No. 1",
      abv: 43,
    });
  });
});
