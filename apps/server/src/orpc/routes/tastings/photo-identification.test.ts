import { getBottleClassifierContext } from "@peated/server/agents/bottleClassifier/contextAdapters";
import { BottleClassificationResultSchema } from "@peated/server/agents/bottleClassifier/contract";
import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleChecks,
  bottleGroups,
  bottleOperations,
  bottles,
  pendingUploads,
  tastings,
} from "@peated/server/db/schema";
import { listActionableBottleChecks } from "@peated/server/lib/bottleChecks";
import type * as pendingUploadsModule from "@peated/server/lib/pendingUploads";
import type * as photoIdentificationModule from "@peated/server/lib/photoIdentification";
import { verifyPhotoIdentificationCreateToken } from "@peated/server/lib/photoIdentificationCreateToken";
import waitError from "@peated/server/lib/test/waitError";
import type { Context } from "@peated/server/orpc/context";
import { routerClient } from "@peated/server/orpc/router";
import * as Sentry from "@sentry/node";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, vi } from "vitest";

const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());
const runBottleReferenceMock = vi.hoisted(() => vi.fn());
const extractPhotoBottleEvidenceMock = vi.hoisted(() => vi.fn());
const copyPendingImageToBottleMock = vi.hoisted(() => vi.fn());
const sentrySpanSetAttributeMock = vi.hoisted(() => vi.fn());
const sentrySpanSetAttributesMock = vi.hoisted(() => vi.fn());
const originalOpenAiApiKey = config.OPENAI_API_KEY;

vi.mock("@sentry/node", { spy: true });
vi.mock(
  "@peated/server/agents/bottleClassifier/classifyBottleReference",
  () => ({
    classifyBottleReference: classifyBottleReferenceMock,
    runBottleReference: runBottleReferenceMock,
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
  return {
    ...actual,
    copyPendingImageToBottle: copyPendingImageToBottleMock,
  };
});
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
  confidenceBasis,
}: {
  brandName: string;
  bottleName: string;
  confidenceBasis?: {
    positiveEvidence?: string[];
    unresolvedRisks?: {
      category:
        | "trait_conflict"
        | "sibling_ambiguity"
        | "release_ambiguity"
        | "web_evidence_conflict"
        | "insufficient_evidence"
        | "identity_ambiguity"
        | "other";
      note: string;
    }[];
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

async function identifyCreateProposal({
  fixtures,
  user,
  idempotencyKey,
  decision,
  candidates = [],
  suitableAsBottleImage = true,
}: {
  fixtures: { SampleSquareImage: () => Promise<Blob> };
  user: NonNullable<Context["user"]>;
  idempotencyKey: string;
  decision: Record<string, unknown>;
  candidates?: Array<{
    bottleId: number;
    fullName?: string;
  }>;
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
  classifyBottleReferenceMock.mockResolvedValue(
    buildClassification(decision, { candidates }),
  );

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
  const [bottleRows, tastingRows] = await Promise.all([
    db.select({ id: bottles.id }).from(bottles),
    db.select({ id: tastings.id }).from(tastings),
  ]);

  return {
    bottles: bottleRows.length,
    tastings: tastingRows.length,
  };
}

async function countCatalogRows() {
  const [bottleRows, groupRows, aliasRows] = await Promise.all([
    db.select({ id: bottles.id }).from(bottles),
    db.select({ id: bottleGroups.id }).from(bottleGroups),
    db.select({ name: bottleAliases.name }).from(bottleAliases),
  ]);

  return {
    bottles: bottleRows.length,
    groups: groupRows.length,
    aliases: aliasRows.length,
  };
}

describe("POST /tastings/photo-identification", () => {
  beforeEach(() => {
    config.OPENAI_API_KEY = undefined;
    classifyBottleReferenceMock.mockReset();
    runBottleReferenceMock.mockReset();
    runBottleReferenceMock.mockImplementation(async (input) => ({
      result: await classifyBottleReferenceMock(input),
      modelMetadata: null,
    }));
    extractPhotoBottleEvidenceMock.mockReset();
    copyPendingImageToBottleMock.mockClear();
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
    const matchedBottle = await fixtures.Bottle({ name: "Uigeadail" });
    const matchedBottleId = matchedBottle.id;

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
        },
        {
          candidates: [
            {
              bottleId: matchedBottleId,
              fullName: "Ardbeg Uigeadail",
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
        matchedBottle: {
          id: matchedBottleId,
          group: { id: matchedBottle.groupId },
        },
      },
      artifacts: {
        candidates: [
          {
            fullName: "Ardbeg Uigeadail",
          },
        ],
      },
    });
    expect(response.classification.artifacts).toEqual({
      candidates: [
        {
          fullName: "Ardbeg Uigeadail",
        },
      ],
    });
    expect(response.classification.artifacts.candidates[0]).not.toHaveProperty(
      "bottleId",
    );

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
    expect(sentrySpanSetAttributeMock).toHaveBeenCalledWith(
      "photo_identification.field.brand",
      "Ardbeg",
    );
    expect(sentrySpanSetAttributeMock).toHaveBeenCalledWith(
      "photo_identification.field.expression",
      "Uigeadail",
    );
    expect(sentrySpanSetAttributeMock).toHaveBeenCalledWith(
      "photo_identification.local.action",
      "no_match",
    );
    expect(sentrySpanSetAttributeMock).toHaveBeenCalledWith(
      "photo_identification.local.candidate_bottle_ids",
      [],
    );
    expect(sentrySpanSetAttributeMock).toHaveBeenCalledWith(
      "photo_identification.final.candidate_bottle_ids",
      [matchedBottleId],
    );
    expect(sentrySpanSetAttributeMock).toHaveBeenCalledWith(
      "photo_identification.final.candidate_names",
      ["Ardbeg Uigeadail"],
    );
    const candidateIdentityCall = sentrySpanSetAttributeMock.mock.calls.find(
      ([key]) => key === "photo_identification.final.candidate_identity",
    );
    expect(candidateIdentityCall?.[1]).toEqual([expect.any(String)]);
    expect(JSON.parse(candidateIdentityCall?.[1][0])).toEqual(
      expect.objectContaining({
        bottleId: matchedBottleId,
        fullName: "Ardbeg Uigeadail",
        abv: null,
      }),
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

  test("passes exact Peated alias candidates through full photo classification", async ({
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
    classifyBottleReferenceMock.mockResolvedValue(
      buildClassification(
        {
          action: "match",
          matchedBottleId: bottle.id,
        },
        {
          candidates: [
            {
              bottleId: bottle.id,
              fullName: "Ardbeg Uigeadail",
              brand: "Ardbeg",
              source: ["exact"],
            },
          ],
        },
      ),
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
        matchedBottle: { id: bottle.id },
      },
    });
    expect(classifyBottleReferenceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCandidates: [
          expect.objectContaining({
            bottleId: bottle.id,
            fullName: bottle.fullName,
            source: expect.arrayContaining(["exact"]),
          }),
        ],
      }),
    );
  });

  test("persists photo match repairs once for moderator review without exposing them to the user", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail", abv: null });
    const bottleContext = await getBottleClassifierContext(bottle.id);
    if (!bottleContext) throw new Error("Expected Bottle context.");
    const { imageSources: _imageSources, ...persistedBottleContext } =
      bottleContext;

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
          abv: 54.2,
          vintage_year: null,
          release_year: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        imageEvidence: {
          ...buildImageEvidence(pendingUpload.id),
          fieldCandidates: {
            ...buildImageEvidence(pendingUpload.id).fieldCandidates,
            abv: {
              value: 54.2,
              confidence: 0.95,
              sourceExtractorIndexes: [0],
            },
          },
        },
      }),
    );
    const classification = buildClassification(
      {
        action: "match",
        matchedBottleId: bottle.id,
      },
      {
        candidates: [
          {
            bottleId: bottle.id,
            fullName: bottle.fullName,
            brand: bottle.brandId.toString(),
            source: ["exact"],
          },
        ],
        imageEvidence: {
          ...buildImageEvidence("pending-image"),
          fieldCandidates: {
            ...buildImageEvidence("pending-image").fieldCandidates,
            abv: {
              value: 54.2,
              confidence: 0.95,
              sourceExtractorIndexes: [0],
            },
          },
        },
        bottleContexts: [{ ...persistedBottleContext, publicImages: [] }],
      },
    );
    classification.proposedOperations = [
      {
        type: "update_bottle",
        input: {
          bottleId: bottle.id,
          patch: { exact: { abv: 54.2 } },
        },
        rationale: "The readable label states 54.2% ABV.",
        evidenceRefs: [
          { kind: "bottle", bottleId: bottle.id },
          { kind: "source", field: "imageEvidence.fieldCandidates.abv" },
        ],
      },
    ];
    runBottleReferenceMock.mockResolvedValue({
      result: classification,
      modelMetadata: {
        agentDurationMs: 25,
        usage: {
          requests: 1,
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
        },
        toolCalls: { count: 1, names: ["propose_update_bottle"] },
      },
    });

    const input = {
      file: await fixtures.SampleSquareImage(),
      idempotencyKey: "photo-identification-repair-review",
    };
    const first = await routerClient.tastings.photoIdentification(input, {
      context: { user: defaults.user },
    });
    const second = await routerClient.tastings.photoIdentification(input, {
      context: { user: defaults.user },
    });

    expect(first.classification).not.toHaveProperty("proposedOperations");
    expect(second.pendingImage.id).toBe(first.pendingImage.id);
    const checks = await db
      .select()
      .from(bottleChecks)
      .where(eq(bottleChecks.sourceKind, "photo_identification"));
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      intent: "resolve_reference",
      sourceId: first.pendingImage.id,
      model: config.OPENAI_MODEL,
      modelMetadata: expect.objectContaining({
        usage: expect.objectContaining({ totalTokens: 120 }),
      }),
    });
    await expect(
      db
        .select()
        .from(bottleOperations)
        .where(eq(bottleOperations.checkId, checks[0].id)),
    ).resolves.toMatchObject([
      {
        status: "pending_review",
        proposal: expect.objectContaining({ type: "update_bottle" }),
      },
    ]);
    await expect(listActionableBottleChecks()).resolves.toMatchObject({
      results: [
        expect.objectContaining({
          id: checks[0].id,
          sourceKind: "photo_identification",
        }),
      ],
    });
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

  test("routes low-band create proposals to manual review", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-low-band-create",
      decision: buildCreateBottleDecision({
        brandName: "Low Confidence Photo Brand",
        bottleName: "Review Bottle",
        confidenceBasis: {
          positiveEvidence: [],
          unresolvedRisks: [
            {
              category: "insufficient_evidence",
              note: "Evidence is too weak to auto-create this bottle.",
            },
          ],
          toolsUsed: [],
          webEvidence: "not_used",
        },
      }),
    });

    expect(identification.suggestedNextStep).toBe("manual_search");
    expect(identification.createToken).toBeNull();
    expect(identification.classification).toMatchObject({
      status: "classified",
      decision: {
        action: "create_bottle",
        proposedBottle: {
          name: "Review Bottle",
          category: "single_malt",
          brand: {
            id: null,
            name: "Low Confidence Photo Brand",
          },
          distillers: [
            {
              id: null,
              name: "Low Confidence Photo Brand",
            },
          ],
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
        confidenceBasis: {
          positiveEvidence: ["The label text matches a plausible bottle."],
          unresolvedRisks: [
            {
              category: "identity_ambiguity",
              note: "The bottle versus bottling model is uncertain.",
            },
          ],
          toolsUsed: ["initial_local_candidates"],
          webEvidence: "not_used",
        },
      }),
    });

    expect(identification.suggestedNextStep).toBe("manual_search");
    expect(identification.createToken).toBeNull();
  });

  test("requires a signed create proposal token before persistence", async ({
    defaults,
  }) => {
    const before = await countRows();

    const err = await waitError(
      routerClient.tastings.photoIdentificationCreate(
        {
          createToken: "invalid-token",
        },
        {
          context: { user: defaults.user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Photo identification create proposal is no longer valid.]`,
    );
    await expect(countRows()).resolves.toEqual(before);
  });

  test("rejects create proposals before token validation when authentication requirements fail", async ({
    fixtures,
  }) => {
    const unverifiedUser = await fixtures.User({ verified: false });
    const noTermsUser = await fixtures.User({ termsAcceptedAt: null });
    const before = await countCatalogRows();
    const cases = [
      ["unauthenticated", null, 401],
      ["unverified", unverifiedUser, 401],
      ["terms not accepted", noTermsUser, 403],
    ] as const;

    for (const [label, user, status] of cases) {
      const error = await waitError(
        routerClient.tastings.photoIdentificationCreate(
          { createToken: "middleware-only-token" },
          { context: { user } },
        ),
      );

      expect(error, label).toMatchObject({ status });
      await expect(countCatalogRows(), label).resolves.toEqual(before);
    }
  });

  test("signs candidate ids only inside the reviewed classifier decision", async ({
    defaults,
    fixtures,
  }) => {
    const candidateBottleIds = [44175];
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-token-candidates",
      decision: {
        ...buildCreateBottleDecision({
          brandName: "Photo Candidate Token Brand",
          bottleName: "Candidate Token Bottle",
        }),
        candidateBottleIds,
      },
      candidates: [
        {
          bottleId: candidateBottleIds[0],
          fullName: "Photo Candidate Token Brand Existing Candidate",
        },
      ],
    });

    const payload = await verifyPhotoIdentificationCreateToken(
      identification.createToken!,
    );

    expect(payload).not.toHaveProperty("candidateBottleIds");
    expect(payload.decision.candidateBottleIds).toEqual(candidateBottleIds);
  });

  test("rejects a signed create proposal owned by another user", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-wrong-user",
      decision: buildCreateBottleDecision({
        brandName: "Photo Ownership Brand",
        bottleName: "Owned Create Proposal",
      }),
    });
    const otherUser = await fixtures.User();
    const before = await countRows();

    const err = await waitError(
      routerClient.tastings.photoIdentificationCreate(
        { createToken: identification.createToken! },
        { context: { user: otherUser } },
      ),
    );

    expect(err).toMatchObject({
      code: "BAD_REQUEST",
      message: "Photo identification create proposal is no longer valid.",
    });
    await expect(countRows()).resolves.toEqual(before);
  });

  test("default bottle image promotion writes the canonical bottle image", async ({
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
        createToken: identification.createToken!,
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.bottle.imageUrl).toContain(
      `/uploads/bottles/bottle-${response.bottle.id}-pending-upload-`,
    );

    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, response.bottle.id),
    });
    expect(response.bottle.group?.id).toBe(bottle?.groupId);
    expect(bottle?.imageUrl).toMatch(
      new RegExp(
        `^/uploads/bottles/bottle-${response.bottle.id}-pending-upload-.+\\.webp$`,
      ),
    );
  });

  test("canonical duplicate confirmation reuses the exact Bottle without promoting an image", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Photo Canonical Reuse Brand",
      type: ["brand", "distiller"],
    });
    const existingBottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [brand.id],
      name: "Canonical Reuse Bottle",
      category: "single_malt",
      imageUrl: null,
    });
    const [canonicalAlias] = await db
      .update(bottleAliases)
      .set({ assignmentSource: "canonical" })
      .where(eq(bottleAliases.bottleId, existingBottle.id))
      .returning();
    expect(canonicalAlias).toMatchObject({
      bottleId: existingBottle.id,
      name: existingBottle.fullName,
      assignmentSource: "canonical",
    });

    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-canonical-duplicate-reuse",
      decision: buildCreateBottleDecision({
        brandName: brand.name,
        bottleName: existingBottle.name,
      }),
    });
    const before = await countCatalogRows();
    copyPendingImageToBottleMock.mockClear();

    const response = await routerClient.tastings.photoIdentificationCreate(
      { createToken: identification.createToken! },
      { context: { user: defaults.user } },
    );

    expect(response).toMatchObject({
      bottle: {
        id: existingBottle.id,
        imageUrl: null,
      },
    });
    expect(response.warnings).toBeUndefined();
    expect(copyPendingImageToBottleMock).not.toHaveBeenCalled();
    await expect(countCatalogRows()).resolves.toEqual(before);
    await expect(
      db.query.bottles.findFirst({
        where: eq(bottles.id, existingBottle.id),
      }),
    ).resolves.toMatchObject({ imageUrl: null });
  });

  test("create proposal does not rerun photo extraction or classification", async ({
    defaults,
    fixtures,
  }) => {
    const identification = await identifyCreateProposal({
      fixtures,
      user: defaults.user,
      idempotencyKey: "photo-identification-create-no-rerun",
      decision: buildCreateBottleDecision({
        brandName: "Photo No Rerun Brand",
        bottleName: "No Rerun Public Image",
      }),
    });
    extractPhotoBottleEvidenceMock.mockRejectedValue(
      new Error("photo extraction should not rerun"),
    );
    classifyBottleReferenceMock.mockRejectedValue(
      new Error("classification should not rerun"),
    );

    const response = await routerClient.tastings.photoIdentificationCreate(
      {
        createToken: identification.createToken!,
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.warnings).toBeUndefined();
    expect(response.bottle.fullName).toBe(
      "Photo No Rerun Brand No Rerun Public Image",
    );
  });

  test("unsuitable photo creates without writing a canonical image", async ({
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
        createToken: identification.createToken!,
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
        createToken: identification.createToken!,
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
        createToken: identification.createToken!,
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
  });
});
