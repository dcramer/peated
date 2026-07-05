import { BottleClassificationResultSchema } from "@peated/server/agents/bottleClassifier/contract";
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  pendingUploads,
  tastings,
} from "@peated/server/db/schema";
import type * as logModule from "@peated/server/lib/log";
import type * as pendingUploadsModule from "@peated/server/lib/pendingUploads";
import type * as photoIdentificationModule from "@peated/server/lib/photoIdentification";
import waitError from "@peated/server/lib/test/waitError";
import type { Context } from "@peated/server/orpc/context";
import { routerClient } from "@peated/server/orpc/router";
import * as Sentry from "@sentry/node";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());
const extractPhotoBottleEvidenceMock = vi.hoisted(() => vi.fn());
const copyPendingImageToBottleMock = vi.hoisted(() => vi.fn());
const copyPendingImageToBottleReleaseMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());
const sentrySpanSetAttributeMock = vi.hoisted(() => vi.fn());
const sentrySpanSetAttributesMock = vi.hoisted(() => vi.fn());
const originalOpenAiApiKey = config.OPENAI_API_KEY;

vi.mock("@sentry/node", { spy: true });
vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
  }),
);
vi.mock("@peated/server/lib/photoIdentification", async (importOriginal) => ({
  ...(await importOriginal<typeof photoIdentificationModule>()),
  extractPhotoBottleEvidence: extractPhotoBottleEvidenceMock,
}));
vi.mock("@peated/server/lib/pendingUploads", async (importOriginal) => {
  const actual = await importOriginal<typeof pendingUploadsModule>();
  copyPendingImageToBottleMock.mockImplementation(
    actual.copyPendingImageToBottle,
  );
  copyPendingImageToBottleReleaseMock.mockImplementation(
    actual.copyPendingImageToBottleRelease,
  );

  return {
    ...actual,
    copyPendingImageToBottle: copyPendingImageToBottleMock,
    copyPendingImageToBottleRelease: copyPendingImageToBottleReleaseMock,
  };
});
vi.mock("@peated/server/lib/log", () => ({
  logError: logErrorMock satisfies typeof logModule.logError,
}));

function buildImageEvidence(
  sourceImageId: string,
  photoSuitability: Partial<{
    isSingleBottlePhoto: boolean;
    labelReadable: boolean;
    suitableAsTastingImage: boolean;
    suitableAsBottleImage: boolean;
  }> = {},
) {
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
      ...photoSuitability,
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

function buildCreateBottleDecision({
  brandName,
  bottleName,
  confidence = 91,
  confidenceBasis,
}: {
  brandName: string;
  bottleName: string;
  confidence?: number;
  confidenceBasis?: {
    band: "low" | "review" | "auto_verification" | "current_assignment";
    positiveEvidence?: string[];
    unresolvedRisks?: string[];
    toolsUsed?: (
      | "initial_local_candidates"
      | "search_bottles"
      | "search_entities"
      | "openai_web_search"
      | "firecrawl_web_search"
      | "none"
    )[];
    webEvidence?:
      | "not_needed"
      | "not_used"
      | "supportive"
      | "weak"
      | "conflicting";
  };
}) {
  return {
    action: "create_bottle",
    confidence,
    rationale: "Reliable photo evidence supports creating the bottle.",
    confidenceBasis: confidenceBasis
      ? {
          positiveEvidence: [],
          unresolvedRisks: [],
          toolsUsed: [],
          webEvidence: "not_used",
          ...confidenceBasis,
        }
      : undefined,
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
      brand: {
        id: null,
        name: brandName,
      },
      distillers: [
        {
          id: null,
          name: brandName,
        },
      ],
      bottler: null,
    },
  };
}

function buildCreateBottleAndReleaseDecision({
  brandName,
  bottleName,
  releaseEdition,
  releaseImageUrl = null,
}: {
  brandName: string;
  bottleName: string;
  releaseEdition: string;
  releaseImageUrl?: string | null;
}) {
  return {
    action: "create_bottle_and_release",
    confidence: 91,
    rationale: "Reliable photo evidence supports the product identity.",
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
      brand: {
        id: null,
        name: brandName,
      },
      distillers: [
        {
          id: null,
          name: brandName,
        },
      ],
      bottler: null,
    },
    proposedRelease: {
      edition: releaseEdition,
      statedAge: null,
      abv: 43,
      caskStrength: null,
      singleCask: null,
      vintageYear: null,
      releaseYear: null,
      imageUrl: releaseImageUrl,
    },
  };
}

async function identifyCreateProposal({
  fixtures,
  user,
  idempotencyKey,
  decision,
  suitableAsBottleImage = true,
}: {
  fixtures: { SampleSquareImage: () => Promise<Blob> };
  user: NonNullable<Context["user"]>;
  idempotencyKey: string;
  decision: Record<string, unknown>;
  suitableAsBottleImage?: boolean;
}) {
  extractPhotoBottleEvidenceMock.mockImplementation(
    async ({ pendingUpload }) => ({
      extractedIdentity: {
        brand: "Photo Create Test",
        expression: "Scan Proposal",
        series: null,
        distillery: ["Photo Create Test"],
        bottler: null,
        category: "single_malt",
        stated_age: null,
        abv: null,
        vintage_year: null,
        release_year: null,
        cask_strength: null,
        single_cask: null,
        edition: null,
      },
      imageEvidence: buildImageEvidence(pendingUpload.id, {
        suitableAsBottleImage,
      }),
    }),
  );
  classifyBottleReferenceMock.mockResolvedValue(buildClassification(decision));

  return await routerClient.tastings.photoIdentification(
    {
      file: await fixtures.SampleSquareImage(),
      idempotencyKey,
    },
    {
      context: { user },
    },
  );
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
    config.OPENAI_API_KEY = undefined;
    classifyBottleReferenceMock.mockReset();
    extractPhotoBottleEvidenceMock.mockReset();
    copyPendingImageToBottleMock.mockClear();
    copyPendingImageToBottleReleaseMock.mockClear();
    logErrorMock.mockClear();
    sentrySpanSetAttributeMock.mockClear();
    sentrySpanSetAttributesMock.mockClear();
    vi.mocked(Sentry.startSpan).mockImplementation(
      async (_context, callback) =>
        await callback({
          setAttribute: sentrySpanSetAttributeMock,
          setAttributes: sentrySpanSetAttributesMock,
        } as unknown as Parameters<typeof callback>[0]),
    );
  });

  afterEach(() => {
    config.OPENAI_API_KEY = originalOpenAiApiKey;
    vi.mocked(Sentry.startSpan).mockReset();
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
    const matchedBottleId = 44175;

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
          matchedBottleId,
          matchedReleaseId: null,
        },
        {
          candidates: [
            {
              kind: "bottle",
              bottleId: matchedBottleId,
              releaseId: null,
              fullName: "Ardbeg Uigeadail",
              bottleFullName: "Ardbeg Uigeadail",
              brand: "Ardbeg",
              score: 0.98,
              source: ["exact"],
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
        matchedBottleId,
        matchedReleaseId: null,
      },
      artifacts: {
        candidates: [
          {
            bottleId: matchedBottleId,
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
          bottleId: matchedBottleId,
          releaseId: null,
          bottleFullName: "Ardbeg Uigeadail",
          fullName: "Ardbeg Uigeadail",
        },
      ],
    });

    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
    expect(classifyBottleReferenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: `photo_identification:${response.pendingImage.id}`,
      }),
    );
    expect(Sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "gen_ai.invoke_agent",
        name: "invoke_agent Photo Identification",
        attributes: expect.objectContaining({
          "gen_ai.conversation.id": `photo_identification:${response.pendingImage.id}`,
          "photo_identification.pending_image_id": response.pendingImage.id,
        }),
      }),
      expect.any(Function),
    );
    expect(sentrySpanSetAttributeMock).toHaveBeenCalledWith(
      "photo_identification.suggested_next_step",
      "confirm_match",
    );
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

  test("uses exact Peated aliases before full photo classification", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Ardbeg Uigeadail",
    });
    extractPhotoBottleEvidenceMock.mockImplementation(
      async ({ pendingUpload }) => ({
        extractedIdentity: {
          brand: "Ardbeg",
          expression: "Uigeadail",
          series: null,
          distillery: ["Ardbeg"],
          bottler: null,
          category: "single_malt",
          stated_age: null,
          abv: null,
          vintage_year: null,
          release_year: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        imageEvidence: buildImageEvidence(pendingUpload.id),
      }),
    );

    const response = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-exact-alias",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.suggestedNextStep).toBe("confirm_match");
    expect(response.classification).toMatchObject({
      status: "classified",
      decision: {
        action: "match",
        matchedBottleId: bottle.id,
        matchedReleaseId: null,
      },
    });
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
      buildClassification(
        { action: "no_match" },
        {
          searchEvidence: [
            {
              provider: "openai",
              query: "Ardbeg Uigeadail whisky",
              summary: "Ardbeg Uigeadail is a real whisky.",
              results: [
                {
                  title: "Ardbeg Uigeadail",
                  url: "https://www.ardbeg.com/en-us/whiskies/uigeadail",
                  domain: "ardbeg.com",
                  description: "Official product page.",
                  extraSnippets: [],
                },
              ],
            },
          ],
        },
      ),
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
    expect(classifyBottleReferenceMock).toHaveBeenCalledTimes(1);
  });

  test("keeps photo identification successful when log search result URL is malformed", async ({
    fixtures,
    defaults,
  }) => {
    extractPhotoBottleEvidenceMock.mockImplementation(
      async ({ pendingUpload }) => ({
        extractedIdentity: null,
        imageEvidence: buildImageEvidence(pendingUpload.id),
      }),
    );
    const classification = buildClassification({ action: "no_match" });
    classification.artifacts.searchEvidence = [
      {
        provider: "openai",
        query: "Ardbeg Uigeadail whisky",
        summary: "Ardbeg Uigeadail is a real whisky.",
        results: [
          {
            title: "Malformed Search Result",
            url: "not a url",
            domain: null,
            description: "Third-party search result with a malformed URL.",
            extraSnippets: [],
          },
        ],
      },
    ];
    classifyBottleReferenceMock.mockResolvedValue(classification);

    const response = await routerClient.tastings.photoIdentification(
      {
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "photo-identification-malformed-search-url",
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.suggestedNextStep).toBe("manual_search");
  });

  test("rejects when extraction fails", async ({ fixtures, defaults }) => {
    extractPhotoBottleEvidenceMock.mockRejectedValue(
      new Error("vision provider unavailable"),
    );

    const err = await waitError(
      routerClient.tastings.photoIdentification(
        {
          file: await fixtures.SampleSquareImage(),
          idempotencyKey: "photo-identification-extraction-failure",
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Unable to identify bottle from photo.]`,
    );
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

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
          distillery: ["Pōkeno Photo Test"],
          bottler: null,
          category: "single_malt",
          stated_age: null,
          abv: 43,
          vintage_year: null,
          release_year: null,
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

  test("routes low-confidence create proposals to manual review", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-low-confidence-create",
      decision: buildCreateBottleDecision({
        brandName: "Low Confidence Photo Brand",
        bottleName: "Review Bottle",
        confidence: 55,
      }),
    });

    expect(identification.suggestedNextStep).toBe("manual_search");
    expect(identification.classification).toMatchObject({
      status: "classified",
      decision: {
        action: "create_bottle",
        proposedBottle: {
          name: "Review Bottle",
          brand: {
            name: "Low Confidence Photo Brand",
          },
        },
      },
    });
  });

  test("routes review-band create proposals to manual review", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-review-band-create",
      decision: buildCreateBottleDecision({
        brandName: "Review Band Photo Brand",
        bottleName: "Review Band Bottle",
        confidence: 90,
        confidenceBasis: {
          band: "review",
          positiveEvidence: ["The label text matches a plausible bottle."],
          unresolvedRisks: ["The bottle versus bottling model is uncertain."],
          toolsUsed: ["initial_local_candidates"],
          webEvidence: "not_used",
        },
      }),
    });

    expect(identification.suggestedNextStep).toBe("manual_search");
  });

  test("rejects low-confidence create proposals before persistence", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-low-confidence-reject",
      decision: buildCreateBottleDecision({
        brandName: "Rejected Low Confidence Brand",
        bottleName: "Review Before Save",
        confidence: 55,
      }),
    });
    const before = await countRows();

    const err = await waitError(
      routerClient.tastings.photoIdentificationCreate(
        {
          pendingImageId: identification.pendingImage.id,
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Photo identification result needs review before creating a bottle.]`,
    );
    await expect(countRows()).resolves.toEqual(before);
  });

  test("rejects review-band create proposals before persistence", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-review-band-reject",
      decision: buildCreateBottleDecision({
        brandName: "Rejected Review Band Brand",
        bottleName: "Review Band Before Save",
        confidence: 90,
        confidenceBasis: {
          band: "review",
          positiveEvidence: ["The label text matches a plausible bottle."],
          unresolvedRisks: ["The bottle versus bottling model is uncertain."],
          toolsUsed: ["initial_local_candidates"],
          webEvidence: "not_used",
        },
      }),
    });
    const before = await countRows();

    const err = await waitError(
      routerClient.tastings.photoIdentificationCreate(
        {
          pendingImageId: identification.pendingImage.id,
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Photo identification result needs review before creating a bottle.]`,
    );
    await expect(countRows()).resolves.toEqual(before);
  });

  test("approved bottle image on a create bottle proposal writes the canonical bottle image", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-approved-bottle-image",
      decision: buildCreateBottleDecision({
        brandName: "Photo Approved Bottle Brand",
        bottleName: "Public Image Bottle",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
        catalogImageApproval: { target: "bottle" },
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.release).toBeNull();
    expect(response.bottle.imageUrl).toContain(
      `/uploads/bottles/bottle-${response.bottle.id}-pending-upload-`,
    );

    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, response.bottle.id),
    });
    expect(bottle?.imageUrl).toMatch(
      new RegExp(
        `^/uploads/bottles/bottle-${response.bottle.id}-pending-upload-.+\\.webp$`,
      ),
    );
  });

  test("approved release image on a create bottle and release proposal writes the canonical release image", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-approved-release-image",
      decision: buildCreateBottleAndReleaseDecision({
        brandName: "Photo Approved Release Brand",
        bottleName: "Release Image Bottle",
        releaseEdition: "Release Image Edition",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
        catalogImageApproval: { target: "release" },
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.bottle.imageUrl).toBeNull();
    expect(response.release?.imageUrl).toContain(
      `/uploads/bottle-releases/bottle_release-${response.release?.id}-pending-upload-`,
    );

    const release = await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, response.release!.id),
    });
    expect(release?.imageUrl).toMatch(
      new RegExp(
        `^/uploads/bottle-releases/bottle_release-${response.release!.id}-pending-upload-.+\\.webp$`,
      ),
    );
  });

  test("unchecked catalog image approval creates without writing a canonical image", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-unchecked-image",
      decision: buildCreateBottleDecision({
        brandName: "Photo Unchecked Brand",
        bottleName: "Unchecked Public Image",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.bottle.imageUrl).toBeNull();

    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, response.bottle.id),
    });
    expect(bottle?.imageUrl).toBeNull();
  });

  test("unchecked release catalog image approval strips classifier release image URLs", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-unchecked-release-image",
      decision: buildCreateBottleAndReleaseDecision({
        brandName: "Photo Unchecked Release Brand",
        bottleName: "Unchecked Release Public Image",
        releaseEdition: "Unchecked Release Edition",
        releaseImageUrl: "https://example.com/classifier-release.webp",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.bottle.imageUrl).toBeNull();
    expect(response.release?.imageUrl).toBeNull();

    const release = await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, response.release!.id),
    });
    expect(release?.imageUrl).toBeNull();
  });

  test("unsuitable approved photo creates without writing a canonical image", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-unsuitable-image",
      suitableAsBottleImage: false,
      decision: buildCreateBottleDecision({
        brandName: "Photo Unsuitable Brand",
        bottleName: "Unsuitable Public Image",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
        catalogImageApproval: { target: "bottle" },
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.bottle.imageUrl).toBeNull();

    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, response.bottle.id),
    });
    expect(bottle?.imageUrl).toBeNull();
  });

  test("mismatched catalog image approval target creates without writing a canonical image", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-mismatched-image-target",
      decision: buildCreateBottleAndReleaseDecision({
        brandName: "Photo Mismatched Target Brand",
        bottleName: "Mismatched Public Image",
        releaseEdition: "Mismatched Target Edition",
        releaseImageUrl: "https://example.com/classifier-release.webp",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
        catalogImageApproval: { target: "bottle" },
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.bottle.imageUrl).toBeNull();
    expect(response.release?.imageUrl).toBeNull();

    const [bottle, release] = await Promise.all([
      db.query.bottles.findFirst({
        where: eq(bottles.id, response.bottle.id),
      }),
      db.query.bottleReleases.findFirst({
        where: eq(bottleReleases.id, response.release!.id),
      }),
    ]);
    expect(bottle?.imageUrl).toBeNull();
    expect(release?.imageUrl).toBeNull();
  });

  test("copy failure after creation returns warning and keeps the created bottle", async ({
    defaults,
    fixtures,
  }) => {
    const copyError = new Error("copy failed");
    copyPendingImageToBottleMock.mockRejectedValueOnce(copyError);

    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-copy-warning",
      decision: buildCreateBottleDecision({
        brandName: "Photo Copy Warning Brand",
        bottleName: "Warning Public Image",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
        catalogImageApproval: { target: "bottle" },
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toEqual([
      {
        code: "CATALOG_IMAGE_COPY_FAILED",
        message: "The bottle was created, but the public image was not saved.",
      },
    ]);
    expect(response.bottle.id).toBeTruthy();
    expect(response.bottle.imageUrl).toBeNull();

    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, response.bottle.id),
    });
    expect(bottle).toBeDefined();
    expect(bottle?.imageUrl).toBeNull();
    expect(logErrorMock).toHaveBeenCalledWith(copyError, {
      catalogImageApproval: expect.objectContaining({
        target: "bottle",
        targetId: response.bottle.id,
        pendingImageId: identification.pendingImage.id,
        userId: defaults.user.id,
        action: "create_bottle",
        bottleId: response.bottle.id,
        releaseId: null,
        createdBottle: true,
        createdRelease: false,
      }),
    });
  });

  test("release copy failure after creation returns warning and keeps the created release", async ({
    defaults,
    fixtures,
  }) => {
    const copyError = new Error("release copy failed");
    copyPendingImageToBottleReleaseMock.mockRejectedValueOnce(copyError);

    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-release-copy-warning",
      decision: buildCreateBottleAndReleaseDecision({
        brandName: "Photo Release Copy Warning Brand",
        bottleName: "Release Warning Public Image",
        releaseEdition: "Release Warning Edition",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
        catalogImageApproval: { target: "release" },
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toEqual([
      {
        code: "CATALOG_IMAGE_COPY_FAILED",
        message: "The release was created, but the public image was not saved.",
      },
    ]);
    expect(response.bottle.id).toBeTruthy();
    expect(response.release?.id).toBeTruthy();
    expect(response.release?.imageUrl).toBeNull();

    const release = await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, response.release!.id),
    });
    expect(release).toBeDefined();
    expect(release?.imageUrl).toBeNull();
    expect(logErrorMock).toHaveBeenCalledWith(copyError, {
      catalogImageApproval: expect.objectContaining({
        target: "release",
        targetId: response.release!.id,
        pendingImageId: identification.pendingImage.id,
        userId: defaults.user.id,
        action: "create_bottle_and_release",
        bottleId: response.bottle.id,
        releaseId: response.release!.id,
        createdBottle: true,
        createdRelease: true,
      }),
    });
  });

  test("catalog image update race returns warning and keeps the created bottle", async ({
    defaults,
    fixtures,
  }) => {
    const copyPendingImageToBottleImplementation =
      copyPendingImageToBottleMock.getMockImplementation();
    if (!copyPendingImageToBottleImplementation) {
      throw new Error("copyPendingImageToBottle mock is not initialized");
    }

    copyPendingImageToBottleMock.mockImplementationOnce(async (input) => {
      const imageUrl = await copyPendingImageToBottleImplementation(input);
      await db
        .update(bottles)
        .set({ imageUrl: "/uploads/bottles/existing-race-image.webp" })
        .where(eq(bottles.id, input.bottleId));
      return imageUrl;
    });

    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-update-race-warning",
      decision: buildCreateBottleDecision({
        brandName: "Photo Race Warning Brand",
        bottleName: "Race Warning Public Image",
      }),
    });

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        pendingImageId: identification.pendingImage.id,
        catalogImageApproval: { target: "bottle" },
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toEqual([
      {
        code: "CATALOG_IMAGE_COPY_FAILED",
        message: "The bottle was created, but the public image was not saved.",
      },
    ]);
    expect(response.bottle.id).toBeTruthy();
    expect(response.bottle.imageUrl).toContain(
      "/uploads/bottles/existing-race-image.webp",
    );

    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, response.bottle.id),
    });
    expect(bottle?.imageUrl).toBe("/uploads/bottles/existing-race-image.webp");
    expect(logErrorMock).toHaveBeenCalledWith(expect.any(Error), {
      catalogImageApproval: expect.objectContaining({
        target: "bottle",
        targetId: response.bottle.id,
        pendingImageId: identification.pendingImage.id,
        userId: defaults.user.id,
        action: "create_bottle",
        bottleId: response.bottle.id,
        releaseId: null,
        createdBottle: true,
        createdRelease: false,
      }),
    });
  });
});
