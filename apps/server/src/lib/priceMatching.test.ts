import type * as BottleClassifierModule from "@peated/server/agents/bottleClassifier";
import { getBottleClassifierContext } from "@peated/server/agents/bottleClassifier/contextAdapters";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleAliases,
  bottleChecks,
  bottleGroups,
  bottleObservations,
  bottles,
  bottlesToDistillers,
  bottleTombstones,
  changes,
  incomingBottleDecisionLogs,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getPeatedSystemActor, getUserActor } from "@peated/server/lib/actors";
import {
  findBottleReferenceCandidates,
  getBottleCandidateById,
  searchBottleCandidates,
} from "@peated/server/lib/bottleReferenceCandidates";
import type * as CatalogVerificationModule from "@peated/server/lib/catalogVerification";
import { buildBottleCreateInput } from "@peated/server/lib/flatBottleInput";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import {
  applyApprovedStorePriceMatch,
  applyStorePriceBottleRepairFromProposal,
  canClearIgnoredStorePriceAssignment,
  createBottleFromStorePriceMatchProposal,
  ignoreStorePriceMatchProposal,
  resolveStorePriceMatchProposal,
  StorePriceMatchProposalIdentityChangedError,
  upsertStorePriceMatchProposal,
} from "@peated/server/lib/priceMatching";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, sql } from "drizzle-orm";
import pg from "pg";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  observer: NodePgClient,
  blockerPid: number,
): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))
       ORDER BY pid
       LIMIT 1`,
      [blockerPid],
    );
    const blockedPid = result.rows[0]?.pid;
    if (blockedPid) return blockedPid;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for ignored StorePrice identity lock.");
}

const queueBottleCreationVerificationMock = vi.hoisted(() => vi.fn());
const queueEntityCreationVerificationMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/agents/whisky/labelExtractor", () => ({
  extractFromImage: vi.fn(),
  extractFromText: vi.fn(),
}));

vi.mock("@peated/server/agents/bottleClassifier", async (importOriginal) => {
  const actual = await importOriginal<typeof BottleClassifierModule>();
  return {
    ...actual,
    classifyBottleReference: vi.fn(),
    runBottleReference: vi.fn(),
    isIgnoredBottleClassification: (classification: { status: string }) =>
      classification.status === "ignored",
    BottleClassificationError: class BottleClassificationError extends Error {
      artifacts: {
        searchEvidence: unknown[];
        candidates: unknown[];
        extractedIdentity: unknown | null;
      };

      constructor(
        message: string,
        artifacts: {
          searchEvidence?: unknown[];
          candidates?: unknown[];
          extractedIdentity?: unknown | null;
        } = {},
      ) {
        super(message);
        this.name = "BottleClassificationError";
        this.artifacts = {
          searchEvidence: artifacts.searchEvidence ?? [],
          candidates: artifacts.candidates ?? [],
          extractedIdentity: artifacts.extractedIdentity ?? null,
        };
      }
    },
  };
});

vi.mock(
  "@peated/server/agents/bottleClassifier/scrapedBottleReference",
  () => ({
    runScrapedBottleReference: vi.fn(),
  }),
);

vi.mock("@peated/server/lib/openaiEmbeddings", async () => {
  const actual = await vi.importActual("@peated/server/lib/openaiEmbeddings");
  return {
    ...actual,
    getOpenAIEmbedding: vi.fn(),
  };
});

vi.mock("@peated/server/lib/catalogVerification", async () => {
  const actual = await vi.importActual<typeof CatalogVerificationModule>(
    "@peated/server/lib/catalogVerification",
  );
  return {
    ...actual,
    queueBottleCreationVerification: queueBottleCreationVerificationMock,
    queueEntityCreationVerification: queueEntityCreationVerificationMock,
  };
});

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

const supportiveWebEvidenceConfidenceBasis = {
  unresolvedRisks: [],
  webEvidence: "supportive",
};

// The code-derived automation tier reads structured evidence, not the numeric
// confidence score. Supportive web evidence (with no unresolved risks) is the
// anchor that auto-verifies an unmatched existing bottle match; it replaces the
// retired `band: "auto_verification"` signal.
const autoVerificationConfidenceBasis = {
  unresolvedRisks: [],
  webEvidence: "supportive",
};

function buildMockBottleReferenceClassification(
  overrides: Record<string, unknown>,
) {
  const status =
    overrides.status === "ignored" || overrides.ignored === true
      ? "ignored"
      : "classified";
  const rawDecision =
    overrides.decision && typeof overrides.decision === "object"
      ? (overrides.decision as {
          action?: string;
          confidence?: number | null;
        })
      : null;
  const decision =
    rawDecision && typeof rawDecision.action === "string"
      ? normalizeMockBottleClassifierDecision(
          rawDecision as Record<string, any>,
        )
      : rawDecision;
  const {
    decision: _decision,
    extractedLabel,
    searchEvidence,
    candidateBottles,
    resolvedEntities,
    bottleContexts,
    entityContexts,
    ignored: _ignored,
    ignoreReason,
    ...restOverrides
  } = overrides;

  return {
    status,
    ...(status === "ignored"
      ? {
          reason:
            typeof ignoreReason === "string" && ignoreReason.length > 0
              ? ignoreReason
              : "ignored",
        }
      : {
          decision,
        }),
    artifacts: {
      extractedIdentity: extractedLabel ?? null,
      searchEvidence: Array.isArray(searchEvidence) ? searchEvidence : [],
      candidates: Array.isArray(candidateBottles) ? candidateBottles : [],
      resolvedEntities: Array.isArray(resolvedEntities) ? resolvedEntities : [],
      bottleContexts: Array.isArray(bottleContexts) ? bottleContexts : [],
      entityContexts: Array.isArray(entityContexts) ? entityContexts : [],
    },
    ...restOverrides,
  } as any;
}

async function inspectedBottleContext(bottleId: number) {
  const context = await getBottleClassifierContext(bottleId);
  if (!context) throw new Error(`Missing Bottle context for ${bottleId}`);
  const { imageSources: _imageSources, ...fields } = context;
  return { ...fields, publicImages: [] };
}

async function countBottles() {
  const rows = await db.select({ id: bottles.id }).from(bottles);
  return rows.length;
}

function normalizeMockBottleClassifierDecision(decision: Record<string, any>) {
  const action =
    decision.action === "match_existing" || decision.action === "correction"
      ? "match"
      : decision.action === "create_new"
        ? "create_bottle"
        : decision.action;
  const base = {
    rationale: decision.rationale ?? null,
    candidateBottleIds: decision.candidateBottleIds ?? [],
    identityScope: decision.identityScope ?? "product",
    aliasScope: decision.aliasScope,
    observation: decision.observation ?? null,
    confidenceBasis: decision.confidenceBasis ?? null,
  };

  if (action === "match") {
    return {
      ...base,
      action,
      matchedBottleId: decision.matchedBottleId ?? decision.suggestedBottleId,
      proposedBottle: null,
    };
  }

  if (action === "create_bottle") {
    return {
      ...base,
      action,
      matchedBottleId: null,
      proposedBottle: decision.proposedBottle ?? null,
    };
  }

  if (action === "no_match") {
    return {
      ...base,
      action,
      matchedBottleId: null,
      proposedBottle: null,
    };
  }

  return { ...base, action };
}

describe("priceMatching", () => {
  const originalAIGatewayApiKey = config.AI_GATEWAY_API_KEY;

  beforeEach(async () => {
    vi.resetAllMocks();
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const { runScrapedBottleReference } =
      await import("@peated/server/agents/bottleClassifier/scrapedBottleReference");
    vi.mocked(runScrapedBottleReference).mockImplementation(
      async (...args) => ({
        result: await vi.mocked(classifyBottleReference)(...args),
        modelMetadata: null,
      }),
    );
    config.AI_GATEWAY_API_KEY = originalAIGatewayApiKey;
  });

  afterEach(() => {
    config.AI_GATEWAY_API_KEY = originalAIGatewayApiKey;
  });

  test("passes normalized source identity to the classifier", async ({
    fixtures,
  }) => {
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const { runScrapedBottleReference } =
      await import("@peated/server/agents/bottleClassifier/scrapedBottleReference");
    const sourceIdentity = {
      brand: "The Gauldrons",
      bottler: null,
      expression: "Eclipse – Finished in Orange Wine Casks",
      series: null,
      distillery: null,
      category: "blend" as const,
      stated_age: null,
      abv: 52.9,
      release_year: null,
      vintage_year: null,
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "The Gauldrons Eclipse",
      imageUrl: "/media/the-gauldrons-eclipse.png",
      sourceBottleIdentity: sourceIdentity,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "no_match",
          rationale: "No safe local match.",
          candidateBottleIds: [],
          matchedBottleId: null,
          proposedBottle: null,
        },
        extractedLabel: sourceIdentity,
      }),
    );

    await resolveStorePriceMatchProposal(price.id);

    expect(runScrapedBottleReference).toHaveBeenCalledWith(
      expect.objectContaining({ extractedIdentity: sourceIdentity }),
    );
  });

  test("auto creates a Bottle from complete structured scraper facts without web evidence", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;
    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const sourceIdentity = {
      brand: "The Gauldrons",
      bottler: null,
      expression: "Eclipse – Finished in Orange Wine Casks",
      series: null,
      distillery: null,
      category: "blend" as const,
      stated_age: null,
      abv: 52.9,
      release_year: null,
      vintage_year: null,
      cask_strength: null,
      single_cask: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      edition: null,
    };
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "The Gauldrons Eclipse",
      imageUrl: null,
      sourceBottleIdentity: sourceIdentity,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          rationale: "Structured scraper facts identify a distinct Bottle.",
          confidenceBasis: {
            unresolvedRisks: [],
            webEvidence: "not_needed",
          },
          candidateBottleIds: [],
          proposedBottle: {
            name: "Eclipse – Finished in Orange Wine Casks",
            series: null,
            category: "blend",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: null,
            abv: 52.9,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: { id: null, name: "The Gauldrons" },
            distillers: [],
            bottler: null,
          },
        },
        extractedLabel: sourceIdentity,
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      automationAssessment: expect.objectContaining({
        automationEligible: true,
        automationScore: 100,
        automationBlockers: [],
      }),
    });
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
    expect(createdBottle).toMatchObject({
      name: "Eclipse – Finished in Orange Wine Casks - 52.9% ABV",
      category: "blend",
      abv: 52.9,
    });
  });

  test("falls back to exact candidates when embeddings fail", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = "test-gateway-key";
    const { getOpenAIEmbedding } =
      await import("@peated/server/lib/openaiEmbeddings");
    vi.mocked(getOpenAIEmbedding).mockRejectedValue(
      new Error("Embeddings unavailable"),
    );

    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Fallback Candidate",
    });

    const candidates = await findBottleReferenceCandidates(
      {
        name: "Fallback Candidate",
        bottleId: null,
      },
      null,
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("resolves exact aliases through direct Bottle ownership", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const targetBottle = await fixtures.Bottle({
      name: "Authoritative Exact Candidate",
      edition: "Target edition",
    });
    await fixtures.BottleAlias({
      bottleId: targetBottle.id,
      name: "Direct Bottle Alias ZXQ",
    });

    const candidates = await searchBottleCandidates({
      query: "Direct Bottle Alias ZXQ",
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: targetBottle.id,
          alias: "Direct Bottle Alias ZXQ",
          fullName: targetBottle.fullName,
          edition: "Target edition",
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("uses assigned aliases and excludes ignored or unresolved aliases", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const member = await fixtures.Bottle({ name: "Alias Scope Member" });
    await fixtures.BottleAlias({
      bottleId: member.id,
      name: "Assigned Alias Scope ZXQ",
    });
    await fixtures.BottleAlias({
      bottleId: member.id,
      ignored: true,
      name: "Ignored Alias Scope ZXQ",
    });
    await fixtures.BottleAlias({
      bottleId: null,
      name: "Unresolved Alias Scope ZXQ",
    });

    const assignedCandidates = await searchBottleCandidates({
      query: "Assigned Alias Scope ZXQ",
      limit: 15,
    });
    const ignoredCandidates = await searchBottleCandidates({
      query: "Ignored Alias Scope ZXQ",
      limit: 15,
    });
    const unresolvedCandidates = await searchBottleCandidates({
      query: "Unresolved Alias Scope ZXQ",
      limit: 15,
    });

    expect(assignedCandidates).toEqual([
      expect.objectContaining({
        bottleId: member.id,
        alias: "Assigned Alias Scope ZXQ",
        source: expect.arrayContaining(["exact"]),
      }),
    ]);
    expect(ignoredCandidates).toEqual([]);
    expect(unresolvedCandidates).toEqual([]);
  });

  test("excludes tombstoned Bottles from exact, text, and direct candidate lookup", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const retired = await fixtures.Bottle({
      name: "Retired Candidate Identity ZXQ",
    });
    const replacement = await fixtures.Bottle({
      name: "Replacement Candidate Identity",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    await expect(
      searchBottleCandidates({
        query: retired.fullName,
        limit: 15,
      }),
    ).resolves.toEqual([]);
    await expect(getBottleCandidateById(retired.id)).resolves.toBeNull();
  });

  test("loads an active Bottle candidate directly by id", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const parent = await fixtures.LegacyBottle({ name: "Historical Parent" });
    await expect(getBottleCandidateById(parent.id)).resolves.toMatchObject({
      bottleId: parent.id,
      fullName: parent.fullName,
    });

    await db.insert(bottleTombstones).values({
      bottleId: parent.id,
      newBottleId: (await fixtures.Bottle({ name: "Promotion Survivor" })).id,
    });
    await expect(getBottleCandidateById(parent.id)).resolves.toBeNull();
  });

  test("finds age-specific photo candidates when stored bottles are missing ABV", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      type: ["brand", "distiller"],
      name: "Pappy Van Winkle's",
    });
    const fifteenYearBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "15-year-old Family Reserve",
      category: "bourbon",
      statedAge: 15,
      abv: null,
    });
    const twentyYearBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "20-year-old Family Reserve",
      category: "bourbon",
      statedAge: 20,
      abv: null,
    });

    for (const [age, abv, bottle] of [
      [15, 53.5, fifteenYearBottle],
      [20, 45.2, twentyYearBottle],
    ] as const) {
      const candidates = await findBottleReferenceCandidates(
        {
          name: `Pappy Van Winkle's Family Reserve ${age} year old`,
          bottleId: null,
        },
        {
          brand: "Pappy Van Winkle's",
          bottler: null,
          expression: "Family Reserve",
          series: null,
          distillery: [],
          category: "bourbon",
          stated_age: age,
          abv,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
      );

      expect(candidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            bottleId: bottle.id,
            fullName: `Pappy Van Winkle's ${age}-year-old Family Reserve`,
            statedAge: age,
            abv: null,
          }),
        ]),
      );
    }

    const fifteenYearPhotoCandidates = await findBottleReferenceCandidates(
      {
        name: "Pappy Van Winkle's Family Reserve 15 year old",
        bottleId: null,
      },
      {
        brand: "Pappy Van Winkle's",
        bottler: null,
        expression: "Family Reserve",
        series: null,
        distillery: [],
        category: "bourbon",
        stated_age: 15,
        abv: 53.5,
        release_year: null,
        vintage_year: null,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
        cask_strength: null,
        single_cask: null,
        edition: null,
      },
    );

    expect(fifteenYearPhotoCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: fifteenYearBottle.id,
          statedAge: 15,
          abv: null,
        }),
        expect.objectContaining({
          bottleId: twentyYearBottle.id,
          statedAge: 20,
          abv: null,
        }),
      ]),
    );
  });

  test("prefers structured extracted identity over noisy retailer titles for exact lookup", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Shibui",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Pure Malt",
    });

    const candidates = await searchBottleCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("includes extracted cask flags in exact alias lookup", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Shibui",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Pure Malt",
      singleCask: true,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Shibui Pure Malt Single Cask",
    });

    const candidates = await searchBottleCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_strength: null,
      single_cask: true,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          alias: "Shibui Pure Malt Single Cask",
          source: expect.arrayContaining(["exact"]),
          singleCask: true,
        }),
      ]),
    );
  });

  test("finds existing SMWS bottles by code when the source omits the subtitle", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      type: ["brand", "bottler"],
      name: "SMWS Candidate Society",
      shortName: "SMWS",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.331 Ultra hoggie",
      singleCask: true,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.3310 False lead",
      singleCask: true,
    });
    for (let index = 1; index <= 6; index += 1) {
      await fixtures.Bottle({
        brandId: brand.id,
        bottlerId: brand.id,
        name: `135.331 False lead ${index}`,
        singleCask: true,
      });
    }

    const candidates = await searchBottleCandidates({
      query: "SMWS 35.331",
      brand: "SMWS",
      expression: null,
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_strength: null,
      single_cask: true,
      edition: "35.331",
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          fullName: "SMWS 35.331 Ultra hoggie",
          source: expect.arrayContaining(["brand"]),
        }),
      ]),
    );
  });

  test("the canonical price create path safely reuses an existing SMWS code identity", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const reviewer = await fixtures.User();
    const brand = await fixtures.Entity({
      type: ["brand", "bottler"],
      name: "SMWS Price Guard Society",
      shortName: "SMWS",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.331 Ultra hoggie",
      singleCask: true,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.3310 False lead",
      singleCask: true,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "135.331 False lead",
      singleCask: true,
    });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "SMWS 35.331",
      imageUrl: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        extractedLabel: {
          brand: "SMWS",
          bottler: "SMWS",
          expression: null,
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: "35.331",
        },
        proposedBottle: {
          name: "35.331",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
          caskStrength: null,
          singleCask: true,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: brand.id,
            name: "SMWS",
          },
          distillers: [],
          bottler: {
            id: brand.id,
            name: "SMWS",
          },
        },
      })
      .returning();
    const bottleCount = await countBottles();
    const groupCount = (
      await db.select({ id: bottleGroups.id }).from(bottleGroups)
    ).length;
    const input = {
      name: "35.331",
      series: null,
      category: "single_malt" as const,
      edition: null,
      statedAge: null,
      caskStrength: null,
      singleCask: true,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      brand: brand.id,
      distillers: [],
      bottler: brand.id,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      flavorProfile: null,
    };

    const bottleInput = buildBottleCreateInput(input);
    const result = await createBottleFromStorePriceMatchProposal({
      proposalId: proposal.id,
      bottleInput,
      user: reviewer,
      actor: await getUserActor(reviewer),
    });

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });
    expect(result).toMatchObject({ bottle: { id: bottle.id } });
    expect(result).not.toHaveProperty("targetId");
    expect(await countBottles()).toBe(bottleCount);
    expect(
      (await db.select({ id: bottleGroups.id }).from(bottleGroups)).length,
    ).toBe(groupCount);
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: reviewer.id,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: bottle.id,
    });
    expect(listingAlias).toMatchObject({
      bottleId: bottle.id,
    });
    expect(decisionLog).toMatchObject({
      sourceKind: "store_price",
      sourceId: price.id,
      proposalId: proposal.id,
      decision: "match_existing",
      bottleId: bottle.id,
      createdBottle: false,
      createdRelease: false,
    });
  });

  test("create_new approval only reuses an active nonignored exact canonical Bottle", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({
      name: "Canonical Reuse Brand",
      type: ["brand"],
    });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const firstPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Canonical Reuse First Listing",
    });
    const secondPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Canonical Reuse Second Listing",
    });
    const [firstProposal, secondProposal] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: firstPrice.id,
          status: "pending_review",
          proposalType: "create_new",
        },
        {
          priceId: secondPrice.id,
          status: "pending_review",
          proposalType: "create_new",
        },
      ])
      .returning();
    const input = {
      name: "Exact Expression",
      statedAge: null,
      series: null,
      category: "single_malt" as const,
      brand: brand.id,
      distillers: [],
      bottler: null,
      edition: "Batch 1",
      caskStrength: null,
      singleCask: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      description: null,
      descriptionSrc: null,
      tastingNotes: null,
      imageUrl: null,
      flavorProfile: null,
    };
    const bottleInput = buildBottleCreateInput(input);

    const first = await createBottleFromStorePriceMatchProposal({
      proposalId: firstProposal.id,
      bottleInput,
      user: reviewer,
      actor: await getUserActor(reviewer),
    });
    const second = await createBottleFromStorePriceMatchProposal({
      proposalId: secondProposal.id,
      bottleInput,
      user: reviewer,
      actor: await getUserActor(reviewer),
    });

    expect(second.bottle.id).toBe(first.bottle.id);
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, secondProposal.id),
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: first.bottle.id,
      suggestedBottleId: first.bottle.id,
    });

    await db
      .update(bottleAliases)
      .set({ ignored: true })
      .where(eq(bottleAliases.name, first.bottle.fullName));
    const ignoredPrice = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "Canonical Reuse Ignored Listing",
    });
    const [ignoredProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: ignoredPrice.id,
        status: "pending_review",
        proposalType: "create_new",
      })
      .returning();

    await expect(
      createBottleFromStorePriceMatchProposal({
        proposalId: ignoredProposal.id,
        bottleInput,
        user: reviewer,
        actor: await getUserActor(reviewer),
      }),
    ).rejects.toMatchObject({
      bottleId: first.bottle.id,
      collision: { kind: "alias" },
    });
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, ignoredProposal.id),
      }),
    ).toMatchObject({ status: "pending_review" });
  });

  test("prefers a literal exact alias over apostrophe-normalized fallback matches", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Alias Preference Brand",
    });
    const literalBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Founder's Cut",
    });
    const normalizedBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Founders Cut Reserve",
    });
    await fixtures.BottleAlias({
      bottleId: literalBottle.id,
      name: "Founder's Cut",
    });
    await fixtures.BottleAlias({
      bottleId: normalizedBottle.id,
      name: "Founders Cut",
    });

    const candidates = await searchBottleCandidates({
      query: "Founder's Cut",
      brand: null,
      bottler: null,
      expression: null,
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates[0]).toMatchObject({
      bottleId: literalBottle.id,
      alias: "Founder's Cut",
    });
    expect(candidates[0]?.source).toEqual(expect.arrayContaining(["exact"]));
  });

  test("normalizes string bottle ids returned from raw candidate queries", async () => {
    config.AI_GATEWAY_API_KEY = "test-gateway-key";

    const { getOpenAIEmbedding } =
      await import("@peated/server/lib/openaiEmbeddings");
    vi.mocked(getOpenAIEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy.mockImplementation(async () => ({
      rows: [
        {
          bottleId: "123",
          alias: "Synthetic Candidate",
          fullName: "Synthetic Candidate",
          brand: "Synthetic Brand",
          score: "0.91",
        },
      ],
    }));

    const candidates = await searchBottleCandidates({
      query: "Synthetic Candidate",
      brand: null,
      expression: null,
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        bottleId: 123,
        alias: "Synthetic Candidate",
      }),
    ]);
  });

  test("normalizes fractional classifier confidence before persisting proposals", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Fractional Confidence Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Confidence Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Confidence Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 0.88,
          rationale: "Alias and listing details strongly match.",
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: "Fractional Confidence Candidate",
            fullName: bottle.fullName,
            brand: null,
            bottler: null,
            series: null,
            distillery: [],
            category: null,
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.95,
            source: ["exact"],
          },
        ],
        resolvedEntities: [],
      }),
    );
    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("match_existing");
    expect(proposal.confidence).toBeNull();
    expect(proposal.automationAssessment).toMatchObject({
      modelConfidence: null,
      automationEligible: false,
      automationScore: null,
    });
  });

  test("keeps a plain age-statement match instead of drifting into a cask-strength release proposal", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const tomatin = await fixtures.Entity({
      name: "Tomatin",
      type: ["brand", "distiller"],
    });
    const generic12Bottle = await fixtures.Bottle({
      brandId: tomatin.id,
      distillerIds: [tomatin.id],
      name: "12-year-old",
      category: "single_malt",
      statedAge: 12,
    });
    const bourbonAndSherryBottle = await fixtures.Bottle({
      brandId: tomatin.id,
      distillerIds: [tomatin.id],
      name: "12-year-old Bourbon & Sherry Casks",
      category: "single_malt",
      statedAge: 12,
    });
    const caskStrengthBottle = await fixtures.Bottle({
      brandId: tomatin.id,
      distillerIds: [tomatin.id],
      name: "Cask Strength",
      category: "single_malt",
      caskStrength: true,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Tomatin Single Malt 12-year-old",
      imageUrl: null,
      url: "https://www.totalwine.com/example",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Tomatin",
      bottler: null,
      expression: null,
      series: null,
      distillery: ["Tomatin"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 95,
          rationale:
            "The listing supports the generic 12-year-old bottle, not a cask-strength sibling.",
          suggestedBottleId: generic12Bottle.id,
          candidateBottleIds: [
            generic12Bottle.id,
            bourbonAndSherryBottle.id,
            caskStrengthBottle.id,
          ],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: generic12Bottle.id,
            alias: "Tomatin Single Malt 12-year-old",
            fullName: generic12Bottle.fullName,
            brand: "Tomatin",
            bottler: null,
            series: null,
            distillery: ["Tomatin"],
            category: "single_malt",
            statedAge: 12,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["text"],
          },
          {
            bottleId: bourbonAndSherryBottle.id,
            alias: null,
            fullName: bourbonAndSherryBottle.fullName,
            brand: "Tomatin",
            bottler: null,
            series: null,
            distillery: ["Tomatin"],
            category: "single_malt",
            statedAge: 12,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["text"],
          },
          {
            bottleId: caskStrengthBottle.id,
            alias: null,
            fullName: caskStrengthBottle.fullName,
            brand: "Tomatin",
            bottler: null,
            series: null,
            distillery: ["Tomatin"],
            category: "single_malt",
            statedAge: null,
            edition: null,
            caskStrength: true,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["text"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal).toMatchObject({
      status: "pending_review",
      proposalType: "match_existing",
      suggestedBottleId: generic12Bottle.id,
      proposedBottle: null,
    });
    expect(proposal.candidateBottles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: generic12Bottle.id,
          fullName: generic12Bottle.fullName,
        }),
        expect.objectContaining({
          bottleId: bourbonAndSherryBottle.id,
          fullName: bourbonAndSherryBottle.fullName,
        }),
        expect.objectContaining({
          bottleId: caskStrengthBottle.id,
          fullName: caskStrengthBottle.fullName,
          caskStrength: true,
        }),
      ]),
    );
  });

  test("auto approves high-confidence matches that reaffirm the current bottle assignment", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "Example Distillery",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [brand.id],
      name: "Port Cask",
      category: "single_malt",
      statedAge: 10,
      abv: 58.4,
      caskType: "tawny_port",
    });
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Example Distillery Port Cask 10 Year",
      imageUrl: null,
      url: "https://totalwine.com/example",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Example Distillery",
      bottler: null,
      expression: "Port Cask",
      series: null,
      distillery: ["Example Distillery"],
      category: "single_malt",
      stated_age: 10,
      abv: 58.4,
      release_year: null,
      vintage_year: null,
      cask_type: "tawny_port",
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 80,
          rationale: "The current bottle identity already matches cleanly.",
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: "Example Distillery Port Cask 10 Year",
            fullName: "Example Distillery Port Cask 10 Year",
            brand: "Example Distillery",
            bottler: null,
            series: null,
            distillery: ["Example Distillery"],
            category: "single_malt",
            statedAge: 10,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: 58.4,
            vintageYear: null,
            releaseYear: null,
            caskType: "tawny_port",
            caskSize: null,
            caskFill: null,
            score: 0.91,
            source: ["current", "exact"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });
    const rawListingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, price.name),
    });
    const observation = await db.query.bottleObservations.findFirst({
      where: (bottleObservations, { eq }) =>
        eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(listingAlias?.bottleId).toBe(bottle.id);
    expect(rawListingAlias).toBeUndefined();
    expect(observation).toMatchObject({
      bottleId: bottle.id,
      sourceType: "store_price",
    });
  });

  test("auto approves unmatched exact matches when classifier confidence is extremely high", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Fractional Confidence Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Confidence Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Confidence Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 97,
          rationale: "The listing exactly matches a canonical alias.",
          confidenceBasis: autoVerificationConfidenceBasis,
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: "Fractional Confidence Candidate",
            fullName: bottle.fullName,
            brand: null,
            bottler: null,
            series: null,
            distillery: [],
            category: null,
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.95,
            source: ["exact"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });
    expect(decisionLog).toMatchObject({
      sourceKind: "store_price",
      sourceId: price.id,
      proposalId: proposal.id,
      actorId: (await getPeatedSystemActor()).id,
      decision: "match_existing",
      bottleId: bottle.id,
      createdBottle: false,
      createdRelease: false,
      confidence: null,
    });
  });

  test("auto approves unmatched high-confidence text matches when the raw title clearly reaffirms the bottle", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle({
      name: "Cold Brew",
      fullName: "Jameson Cold Brew",
      category: "blend",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Jameson Cold Brew Irish Whiskey",
      imageUrl: null,
      url: "https://woodencork.com/collections/whiskey/products/jameson-cold-brew?utm=peated",
    });

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: null,
        decision: {
          action: "match_existing",
          confidence: 98,
          rationale:
            "The raw title directly reaffirms the existing Jameson Cold Brew bottle.",
          confidenceBasis: autoVerificationConfidenceBasis,
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: null,
            fullName: "Jameson Cold Brew",
            brand: "Jameson",
            bottler: null,
            series: null,
            distillery: [],
            category: "blend",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["text", "brand"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
  });

  test("persists classifier-reviewed no_match decisions for unsupported non-exact matches", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "Wild Turkey",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [brand.id],
      name: "Rare Breed Barrel-Proof Kentucky Straight Rye",
      category: "rye",
      caskStrength: true,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Wild Turkey Rare Breed Rye",
      imageUrl: null,
      url: "https://shop.example/wild-turkey-rare-breed-rye",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Wild Turkey",
      bottler: null,
      expression: "Rare Breed",
      series: null,
      distillery: ["Wild Turkey"],
      category: "rye",
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "no_match",
          confidence: 82,
          rationale:
            "Server downgraded the existing-match recommendation because the local candidate is more specific than the listing and lacks supportive web evidence.",
          suggestedBottleId: null,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        extractedLabel: {
          brand: "Wild Turkey",
          bottler: null,
          expression: "Rare Breed",
          series: null,
          distillery: ["Wild Turkey"],
          category: "rye",
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
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: null,
            fullName: bottle.fullName,
            brand: "Wild Turkey",
            bottler: null,
            series: null,
            distillery: ["Wild Turkey"],
            category: "rye",
            statedAge: null,
            edition: null,
            caskStrength: true,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.86,
            source: ["brand"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("no_match");
    expect(proposal.suggestedBottleId).toBeNull();
    expect(proposal.rationale).toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("keeps non-exact existing matches when validated web evidence validates an omitted target trait", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "Wild Turkey",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [brand.id],
      name: "Rare Breed Barrel-Proof Kentucky Straight Rye",
      category: "rye",
      caskStrength: true,
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Wild Turkey Rare Breed Rye",
      imageUrl: null,
      url: "https://shop.example/wild-turkey-rare-breed-rye",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Wild Turkey",
      bottler: null,
      expression: "Rare Breed",
      series: null,
      distillery: ["Wild Turkey"],
      category: "rye",
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 84,
          rationale:
            "Reliable web evidence confirms Rare Breed Rye is the barrel-proof Wild Turkey release.",
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [
          {
            query: '"Wild Turkey Rare Breed Rye" barrel proof',
            summary:
              "Wild Turkey says Rare Breed Rye is bottled at barrel proof. Rare Bird 101 also describes it as the brand's barrel-proof rye.",
            results: [
              {
                title:
                  "What is Rye Whiskey & What Makes it So Special? | Wild Turkey",
                url: "https://www.wildturkeybourbon.com/en-us/latest-news/what-is-rye-whiskey/",
                domain: "wildturkeybourbon.com",
                description:
                  "Wild Turkey Rare Breed Rye is bottled at barrel proof.",
                extraSnippets: [],
              },
              {
                title: "Rare Breed Rye (2024) – Rare Bird 101",
                url: "https://rarebird101.com/2024/04/24/rare-breed-rye-2024/",
                domain: "rarebird101.com",
                description:
                  "Rare Bird 101 describes Rare Breed Rye as Wild Turkey's barrel-proof rye.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: null,
            fullName: bottle.fullName,
            brand: "Wild Turkey",
            bottler: null,
            series: null,
            distillery: ["Wild Turkey"],
            category: "rye",
            statedAge: null,
            edition: null,
            caskStrength: true,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.86,
            source: ["brand"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("match_existing");
    expect(proposal.enteredQueueAt).not.toBeNull();
    expect(proposal.suggestedBottleId).toBe(bottle.id);
    expect(proposal.rationale).not.toContain(
      "Server downgraded the existing-match recommendation",
    );
  });

  test("auto-approves high-confidence existing matches when validated web evidence confirms the bottle identity", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "Glenlivet",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Caribbean Reserve Rum Barrel Selection",
      category: "single_malt",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "The Glenlivet Caribbean Reserve",
      imageUrl: null,
      url: "https://www.reservebar.com/products/the-glenlivet-caribbean-reserve/GROUPING-1419170.html",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "The Glenlivet",
      bottler: null,
      expression: "Caribbean Reserve",
      series: null,
      distillery: ["The Glenlivet"],
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "The Glenlivet",
          bottler: null,
          expression: "Caribbean Reserve",
          series: null,
          distillery: ["The Glenlivet"],
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
        decision: {
          action: "match_existing",
          confidence: 96,
          rationale:
            "Official Glenlivet sources confirm Caribbean Reserve as the rum-cask-finished single malt release.",
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [
          {
            provider: "openai",
            query:
              "The Glenlivet Caribbean Reserve official rum barrel selection",
            summary:
              "Official Glenlivet sources describe Caribbean Reserve as a single malt selectively finished in Caribbean rum casks.",
            results: [
              {
                title:
                  "Caribbean Reserve Single Malt Scotch Whisky - The Glenlivet US",
                url: "https://www.theglenlivet.com/en-us/whisky/caribbean-reserve-single-malt-scotch/",
                domain: "theglenlivet.com",
                description:
                  "The Glenlivet Caribbean Reserve is a single malt Scotch whisky selectively finished in Caribbean rum casks.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: null,
            fullName: "Glenlivet Caribbean Reserve Rum Barrel Selection",
            brand: "Glenlivet",
            bottler: "Glenlivet",
            series: null,
            distillery: [],
            category: "single_malt",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["text"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      enteredQueueAt: null,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
  });

  test("auto-approves a safe match without catalog review", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "Example Heritage",
      type: ["brand"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Table Whiskey",
      category: "spirit",
      statedAge: null,
      abv: null,
      distillerIds: [],
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Example Heritage Table Whiskey",
      imageUrl: null,
      url: "https://example.com/table-whiskey",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Example Heritage",
      bottler: null,
      expression: "Table Whiskey",
      series: null,
      distillery: [],
      category: null,
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "Example Heritage",
          bottler: null,
          expression: "Table Whiskey",
          series: null,
          distillery: [],
          category: null,
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        decision: {
          action: "match",
          confidence: 97,
          rationale:
            "The existing Bottle is safe for this reference assignment.",
          confidenceBasis: autoVerificationConfidenceBasis,
          matchedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: "Example Heritage Table Whiskey",
            fullName: "Example Heritage Table Whiskey",
            brand: "Example Heritage",
            bottler: null,
            series: null,
            distillery: [],
            category: "spirit",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["exact"],
          },
        ],
        bottleContexts: [await inspectedBottleContext(bottle.id)],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const updatedBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottle.id),
    });
    const distillerRows = await db
      .select({ bottleId: bottlesToDistillers.bottleId })
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      enteredQueueAt: null,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(updatedBottle).toMatchObject({
      category: "spirit",
      statedAge: null,
      abv: null,
    });
    expect(distillerRows).toEqual([]);
    const check = await db.query.bottleChecks.findFirst({
      where: eq(bottleChecks.storePriceMatchProposalId, proposal.id),
      with: { operations: true },
    });
    expect(check?.operations).toEqual([]);
  });

  test("keeps exact-ish bottle matches when only generic retailer words differ", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Ardbeg Uigeadail Single Malt Scotch Whisky",
      imageUrl: null,
      url: "https://shop.example/ardbeg-uigeadail",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Ardbeg",
      bottler: null,
      expression: "Uigeadail",
      series: null,
      distillery: ["Ardbeg"],
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 84,
          rationale: "The bottle identity matches cleanly.",
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: null,
            fullName: "Ardbeg Uigeadail",
            brand: "Ardbeg",
            bottler: null,
            series: null,
            distillery: ["Ardbeg"],
            category: "single_malt",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.84,
            source: ["brand"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("match_existing");
    expect(proposal.suggestedBottleId).toBe(bottle.id);
  });

  test("keeps local-only create_new proposals in review without mutating model confidence", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Local Only Create Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Local Only Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Local Only Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 95,
          rationale: "Looks like a distinct bottle from local evidence.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Reserve",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 12,
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
              name: "Local Only Brand",
            },
            distillers: [
              {
                id: null,
                name: "Local Only Distillery",
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.confidence).toBeNull();
  });

  test("does not change a create decision into a correction", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "The Whistler",
      type: ["brand", "bottler"],
    });
    const currentBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Bodega Cask",
      category: "blend",
      distillerIds: [],
    });
    const price = await fixtures.StorePrice({
      bottleId: currentBottle.id,
      name: "The Whistler Bodega Cask Single Malt Irish Whiskey",
      imageUrl: null,
      url: "https://shop.example/the-whistler-bodega-cask",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "The Whistler",
      bottler: null,
      expression: "Bodega Cask",
      series: null,
      distillery: ["Boann Distillery"],
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_bottle",
          rationale:
            "The local bottle shares the base name, but the stored category conflicts with official evidence.",
          candidateBottleIds: [currentBottle.id],
          proposedBottle: {
            name: "Bodega Cask",
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
              id: brand.id,
              name: "The Whistler",
            },
            distillers: [
              {
                id: null,
                name: "Boann Distillery",
              },
            ],
            bottler: null,
          },
        },
        extractedLabel: {
          brand: "The Whistler",
          bottler: null,
          expression: "Bodega Cask",
          series: null,
          distillery: ["Boann Distillery"],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        searchEvidence: [
          {
            provider: "openai",
            query: '"The Whistler Bodega Cask" single malt',
            summary:
              "Independent sources describe The Whistler Bodega Cask as a single malt from Boann Distillery.",
            results: [
              {
                title: "The Whistler Bodega Cask - Whiskybase",
                url: "https://www.whiskybase.com/whiskies/whisky/167533/the-whistler-bodega-cask",
                domain: "whiskybase.com",
                description:
                  "Category: Single Malt. Distillery: Boann Distillery.",
                extraSnippets: [],
              },
              {
                title:
                  "Whiskey Review: The Whistler Bodega Cask Irish Single Malt",
                url: "https://thewhiskeywash.com/reviews/whiskey-review-the-whistler-bodega-cask-irish-single-malt/",
                domain: "thewhiskeywash.com",
                description:
                  "Reviewing The Whistler Bodega Cask Irish Single Malt.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [
          {
            bottleId: currentBottle.id,
            alias: "The Whistler Bodega Cask",
            fullName: currentBottle.fullName,
            brand: "The Whistler",
            bottler: null,
            series: null,
            distillery: [],
            category: "blend",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.97,
            source: ["exact"],
          },
        ],
        bottleContexts: [await inspectedBottleContext(currentBottle.id)],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.currentBottleId).toBe(currentBottle.id);
    expect(proposal.suggestedBottleId).toBeNull();
    expect(proposal.proposedBottle).toMatchObject({
      name: "Bodega Cask",
      category: "single_malt",
      brand: {
        name: "The Whistler",
      },
      distillers: [
        {
          name: "Boann Distillery",
        },
      ],
    });
    expect(proposal.rationale).toContain("stored category conflicts");
    const check = await db.query.bottleChecks.findFirst({
      where: eq(bottleChecks.storePriceMatchProposalId, proposal.id),
      with: { operations: true },
    });
    expect(check?.operations).toEqual([]);
  });

  test("keeps a required Bottle correction separate from no_match", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const correctBrand = await fixtures.Entity({
      type: ["brand"],
      name: "The Whistler",
    });
    const distillery = await fixtures.Entity({
      type: ["distiller"],
      name: "Boann Distillery",
    });
    const currentBottle = await fixtures.Bottle({
      brandId: correctBrand.id,
      name: "Bodega Cask",
      category: "blend",
      statedAge: 10,
      distillerIds: [distillery.id],
    });
    const price = await fixtures.StorePrice({
      bottleId: currentBottle.id,
      name: "The Whistler Bodega Cask Single Malt Irish Whiskey",
      imageUrl: null,
      url: "https://shop.example/the-whistler-bodega-cask",
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "The Whistler",
      bottler: null,
      expression: "Bodega Cask",
      series: null,
      distillery: ["Boann Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "no_match",
          confidence: 90,
          rationale:
            "The current Bottle needs a catalog correction before assignment is safe.",
          candidateBottleIds: [currentBottle.id],
          matchedBottleId: null,
          proposedBottle: null,
        },
        extractedLabel: {
          brand: "The Whistler",
          bottler: null,
          expression: "Bodega Cask",
          series: null,
          distillery: ["Boann Distillery"],
          category: "single_malt",
          stated_age: 12,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_strength: null,
          single_cask: null,
          edition: null,
        },
        searchEvidence: [
          {
            provider: "openai",
            query: '"The Whistler Bodega Cask"',
            summary:
              "Independent sources identify this bottling under The Whistler brand.",
            results: [
              {
                title: "The Whistler Bodega Cask",
                url: "https://www.whiskybase.com/whiskies/whisky/167533/the-whistler-bodega-cask",
                domain: "whiskybase.com",
                description:
                  "The Whistler Bodega Cask Irish Single Malt from Boann Distillery.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [
          {
            bottleId: currentBottle.id,
            alias: "The Whistler Bodega Cask",
            fullName: currentBottle.fullName,
            brand: "The Whistler",
            bottler: null,
            series: null,
            distillery: ["Boann Distillery"],
            category: "blend",
            statedAge: 10,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.96,
            source: ["exact"],
          },
        ],
        bottleContexts: [await inspectedBottleContext(currentBottle.id)],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("correction");
    expect(proposal.currentBottleId).toBe(currentBottle.id);
    expect(proposal.suggestedBottleId).toBeNull();
    expect(proposal.proposedBottle).toBeNull();
    const check = await db.query.bottleChecks.findFirst({
      where: eq(bottleChecks.storePriceMatchProposalId, proposal.id),
      with: { operations: true },
    });
    expect(check?.output).toMatchObject({
      decision: { action: "no_match", matchedBottleId: null },
    });
    expect(check?.operations).toEqual([]);
  });

  test("rolls back a repair when its suggested Bottle changes behind the Bottle lock", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Repair Drift Brand",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Repair Drift",
      category: "single_malt",
      edition: "Original Edition",
      distillerIds: [],
    });
    const replacement = await fixtures.Bottle({
      name: "Concurrent Repair Suggestion",
    });
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Repair Identity Drift Listing",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        currentBottleId: bottle.id,
        suggestedBottleId: bottle.id,
        proposedBottle: {
          name: bottle.name,
          series: null,
          category: "single_malt",
          edition: "Changed Edition",
          statedAge: null,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: { id: brand.id, name: brand.name },
          distillers: [],
          bottler: null,
        },
      })
      .returning();

    const blocker = new Client(getPostgresConnectionConfig());
    const mutator = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let approval: ReturnType<
      typeof applyStorePriceBottleRepairFromProposal
    > | null = null;
    let blockerReleased = false;
    let mutatorCommitted = false;

    await blocker.connect();
    await mutator.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load repair blocker pid.");
      await blocker.query("SELECT id FROM bottle WHERE id = $1 FOR UPDATE", [
        bottle.id,
      ]);

      approval = applyStorePriceBottleRepairFromProposal({
        proposalId: proposal.id,
        user: reviewer,
        actor: await getUserActor(reviewer),
      });
      void approval.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await mutator.query("BEGIN");
      await mutator.query(
        `UPDATE store_price_match_proposal
         SET suggested_bottle_id = $2
         WHERE id = $1`,
        [proposal.id, replacement.id],
      );
      await mutator.query("COMMIT");
      mutatorCommitted = true;

      await blocker.query("COMMIT");
      blockerReleased = true;

      await expect(approval).rejects.toBeInstanceOf(
        StorePriceMatchProposalIdentityChangedError,
      );
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      if (!mutatorCommitted) {
        await mutator.query("ROLLBACK").catch(() => undefined);
      }
      if (approval) await approval.catch(() => undefined);
      await blocker.end();
      await mutator.end();
      await observer.end();
    }

    const [updatedBottle, updatedPrice, updatedProposal, alias, observation] =
      await Promise.all([
        db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, price.id),
        }),
        db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, proposal.id),
        }),
        db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
        }),
        db.query.bottleObservations.findFirst({
          where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
        }),
      ]);

    expect(updatedBottle).toMatchObject({
      id: bottle.id,
      name: bottle.name,
      fullName: bottle.fullName,
      edition: "Original Edition",
      brandId: brand.id,
    });
    expect(updatedPrice).toMatchObject({
      id: price.id,
      bottleId: bottle.id,
    });
    expect(updatedProposal).toMatchObject({
      status: "pending_review",
      currentBottleId: bottle.id,
      suggestedBottleId: replacement.id,
      reviewedById: null,
      reviewedAt: null,
    });
    expect(alias).toBeUndefined();
    expect(observation).toBeUndefined();
  });

  test("gives unmarked historical repair ages the exact Bottle owner", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Historical Repair Brand",
    });
    const selectedBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Historical Age",
      category: "single_malt",
      statedAge: 10,
    });
    const sibling = await fixtures.BottleGroupMember({
      groupId: selectedBottle.groupId as number,
      edition: "Sibling Edition",
    });
    const price = await fixtures.StorePrice({
      bottleId: selectedBottle.id,
      name: "Historical Age Repair Listing",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "correction",
        currentBottleId: selectedBottle.id,
        suggestedBottleId: selectedBottle.id,
        proposedBottle: {
          name: "Historical Age",
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: 14,
          caskStrength: null,
          singleCask: null,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: { id: brand.id, name: brand.name },
          distillers: [],
          bottler: null,
        },
      })
      .returning();

    expect(proposal.proposedBottle).not.toHaveProperty("statedAgeScope");
    await applyStorePriceBottleRepairFromProposal({
      proposalId: proposal.id,
      user: reviewer,
      actor: await getUserActor(reviewer),
    });

    const [updatedBottle, updatedSibling, updatedGroup] = await Promise.all([
      db.query.bottles.findFirst({
        where: eq(bottles.id, selectedBottle.id),
      }),
      db.query.bottles.findFirst({
        where: eq(bottles.id, sibling.id),
      }),
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, selectedBottle.groupId!),
      }),
    ]);
    expect(updatedBottle?.statedAge).toBe(14);
    expect(updatedSibling?.statedAge).toBe(10);
    expect(updatedGroup?.statedAge).toBe(10);
  });

  test("persists normalized proposed bottle drafts from the classifier", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Normalized Draft Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Normalized Brand",
      bottler: null,
      expression: "8 Year",
      series: null,
      distillery: ["Normalized Distillery"],
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 85,
          rationale: "The listing looks like a distinct release.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "8-year-old (Batch 7)",
            series: null,
            category: "single_malt",
            edition: "Batch 7",
            statedAge: 8,
            caskStrength: true,
            singleCask: null,
            abv: 46,
            vintageYear: null,
            releaseYear: 2024,
            caskType: "bourbon",
            caskSize: "barrel",
            caskFill: "1st_fill",
            brand: {
              id: null,
              name: "Normalized Brand",
            },
            distillers: [
              {
                id: null,
                name: "Normalized Distillery",
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposedBottle).toMatchObject({
      name: "8-year-old (Batch 7)",
      statedAge: 8,
      edition: "Batch 7",
      caskStrength: true,
      abv: 46,
      releaseYear: 2024,
      brand: {
        name: "Normalized Brand",
      },
    });
  });

  test("treats classifier-reviewed unknown categories as review-only", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Spirit Category Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Spirit Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Spirit Distillery"],
      category: "spirit",
      stated_age: 12,
      abv: null,
      release_year: 2024,
      vintage_year: 2010,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 1",
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "Spirit Brand",
          bottler: null,
          expression: "Reserve",
          series: null,
          distillery: ["Spirit Distillery"],
          category: null,
          stated_age: 12,
          abv: null,
          release_year: 2024,
          vintage_year: 2010,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: null,
          edition: "Batch 1",
        },
        decision: {
          action: "create_new",
          confidence: 96,
          rationale: "Web evidence suggests this is a real release.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Reserve Batch 1 2024",
            series: null,
            category: null,
            edition: "Batch 1",
            statedAge: 12,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: 2010,
            releaseYear: 2024,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: null,
              name: "Spirit Brand",
            },
            distillers: [
              {
                id: null,
                name: "Spirit Distillery",
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [
          {
            query: 'site:woodencork.com "Spirit Category Candidate"',
            summary: "Retailer listing for Spirit Category Candidate.",
            results: [
              {
                title: "Spirit Category Candidate",
                url: "https://woodencork.example/spirit-category-candidate",
                domain: "woodencork.example",
                description: "Retailer listing",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal.status).toBe("pending_review");
    expect(proposal.confidence).toBeNull();
    expect(proposal.extractedLabel).toMatchObject({
      category: null,
      edition: "Batch 1",
      release_year: 2024,
      vintage_year: 2010,
    });
    expect(proposal.proposedBottle).toMatchObject({
      category: null,
      edition: "Batch 1",
      releaseYear: 2024,
      vintageYear: 2010,
    });
    expect(updatedPrice?.bottleId).toBeNull();
  });

  test("does not auto-create from empty web evidence", async ({ fixtures }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Empty Evidence Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Evidence Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Evidence Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 95,
          rationale: "A web search was attempted but found nothing useful.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Reserve",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 12,
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
              name: "Evidence Brand",
            },
            distillers: [
              {
                id: null,
                name: "Evidence Distillery",
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [
          {
            query: 'site:example.com "Empty Evidence Candidate"',
            summary: null,
            results: [],
          },
        ],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.confidence).toBeNull();
    expect(updatedPrice?.bottleId).toBeNull();
  });

  test("auto ignores clearly non-whisky listings", async ({ fixtures }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Tito's Handmade Vodka",
      imageUrl: null,
    });

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is clearly a non-whisky category match and extraction found no whisky identity.",
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal.status).toBe("ignored");
    expect(proposal.proposalType).toBe("no_match");
    expect(proposal.enteredQueueAt).toBeNull();
  });

  test("routes unsupported novelty flavored-whiskey listings through the classifier", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Skrewball Peanut Butter Whiskey",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue(null);
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "no_match",
          confidence: 96,
          rationale:
            "This is a novelty flavored whiskey product, not a genuine whisky bottle.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("no_match");
  });

  test("auto approves SMWS matches through the bottle classifier when aliases differ", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: null,
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      distillerIds: [distiller.id],
      name: "RW6.5 Sauna Smoke",
      category: "rye",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-existing",
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "The Scotch Malt Whisky Society",
          bottler: "The Scotch Malt Whisky Society",
          expression: "RW6.5 Sauna Smoke",
          series: null,
          distillery: ["Kyrö"],
          category: "rye",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: null,
        },
        decision: {
          action: "match_existing",
          confidence: 100,
          rationale: "Classifier matched the SMWS exact-cask code.",
          identityScope: "exact_cask",
          confidenceBasis: autoVerificationConfidenceBasis,
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: price.name,
            fullName: bottle.fullName,
            brand: "The Scotch Malt Whisky Society",
            bottler: "The Scotch Malt Whisky Society",
            series: null,
            distillery: ["Kyrö"],
            category: "rye",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["exact"],
          },
        ],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });
    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(listingAlias?.bottleId).toBe(bottle.id);
  });

  test("auto approves SMWS classifier matches when the price is already linked to the same bottle", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: null,
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      distillerIds: [distiller.id],
      name: "RW6.5 Sauna Smoke",
      category: "rye",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: bottle.id,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-existing-current",
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "The Scotch Malt Whisky Society",
          bottler: "The Scotch Malt Whisky Society",
          expression: "RW6.5 Sauna Smoke",
          series: null,
          distillery: ["Kyrö"],
          category: "rye",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: null,
        },
        decision: {
          action: "match_existing",
          confidence: 100,
          rationale: "Classifier matched the SMWS exact-cask code.",
          identityScope: "exact_cask",
          confidenceBasis: autoVerificationConfidenceBasis,
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: price.name,
            fullName: bottle.fullName,
            brand: "The Scotch Malt Whisky Society",
            bottler: "The Scotch Malt Whisky Society",
            series: null,
            distillery: ["Kyrö"],
            category: "rye",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["current", "exact"],
          },
        ],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(listingAlias?.bottleId).toBe(bottle.id);
  });

  test("auto creates SMWS bottles through classifier-reviewed exact-cask identity", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-new",
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "The Scotch Malt Whisky Society",
          bottler: "The Scotch Malt Whisky Society",
          expression: "RW6.5 Sauna Smoke",
          series: null,
          distillery: ["Kyrö"],
          category: "rye",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: null,
        },
        decision: {
          action: "create_new",
          confidence: 95,
          rationale: "Classifier created the SMWS exact-cask bottle.",
          candidateBottleIds: [],
          proposedBottle: {
            name: "RW6.5 Sauna Smoke",
            series: null,
            category: "rye",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: brand.id,
              name: "SMWS",
            },
            distillers: [
              {
                id: distiller.id,
                name: "Kyrö",
              },
            ],
            bottler: {
              id: brand.id,
              name: "SMWS",
            },
          },
        },
        searchEvidence: [
          {
            provider: "openai",
            query: "SMWS RW6.5 Sauna Smoke",
            summary:
              "The official SMWS page confirms RW6.5 Sauna Smoke as a rye single cask.",
            results: [
              {
                title: "SMWS RW6.5 Sauna Smoke",
                url: "https://smws.com/rw6-5-sauna-smoke",
                domain: "smws.com",
                description:
                  "SMWS RW6.5 Sauna Smoke is a rye whisky from a single cask.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });
    const observation = await db.query.bottleObservations.findFirst({
      where: (bottleObservations, { eq }) =>
        eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });
    const distillerLinks = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, proposal.suggestedBottleId!));

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      currentBottleId: expect.any(Number),
      suggestedBottleId: expect.any(Number),
      reviewedById: expect.any(Number),
    });
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
    expect(createdBottle).toMatchObject({
      name: "RW6.5 Sauna Smoke - Single Cask",
      fullName: "SMWS RW6.5 Sauna Smoke - Single Cask",
      brandId: brand.id,
      bottlerId: brand.id,
      category: "rye",
      singleCask: true,
    });
    expect(listingAlias?.bottleId).toBe(proposal.suggestedBottleId);
    expect(observation).toMatchObject({
      bottleId: proposal.suggestedBottleId,
      sourceType: "store_price",
      parsedIdentity: expect.objectContaining({
        single_cask: true,
      }),
    });
    expect(distillerLinks).toEqual([
      expect.objectContaining({
        bottleId: proposal.suggestedBottleId,
        distillerId: distiller.id,
      }),
    ]);
  });

  test("SMWS classifier auto approval succeeds while a retry lease is active", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: null,
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      distillerIds: [distiller.id],
      name: "RW6.5 Sauna Smoke",
      category: "rye",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-processing",
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "The Scotch Malt Whisky Society",
          bottler: "The Scotch Malt Whisky Society",
          expression: "RW6.5 Sauna Smoke",
          series: null,
          distillery: ["Kyrö"],
          category: "rye",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: null,
        },
        decision: {
          action: "match_existing",
          confidence: 100,
          rationale: "Classifier matched the SMWS exact-cask code.",
          identityScope: "exact_cask",
          confidenceBasis: autoVerificationConfidenceBasis,
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: price.name,
            fullName: bottle.fullName,
            brand: "The Scotch Malt Whisky Society",
            bottler: "The Scotch Malt Whisky Society",
            series: null,
            distillery: ["Kyrö"],
            category: "rye",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["exact"],
          },
        ],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
      processingToken: "lease-token",
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, existingProposal.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      proposalType: "match_existing",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
    expect(updatedPrice?.bottleId).toBe(bottle.id);
  });

  test("does not finalize a replacement attempt after retry lease ownership changes", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: null,
      type: ["brand", "bottler"],
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "7.321 Replacement Lease",
      category: "single_malt",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS 7.321 Replacement Lease",
      imageUrl: null,
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "The Scotch Malt Whisky Society",
          bottler: "The Scotch Malt Whisky Society",
          expression: "7.321 Replacement Lease",
          series: null,
          distillery: [],
          category: "single_malt",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: null,
        },
        decision: {
          action: "match_existing",
          confidence: 100,
          rationale: "Classifier matched the exact SMWS cask code.",
          identityScope: "exact_cask",
          confidenceBasis: autoVerificationConfidenceBasis,
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: price.name,
            fullName: bottle.fullName,
            brand: "The Scotch Malt Whisky Society",
            bottler: "The Scotch Malt Whisky Society",
            series: null,
            distillery: [],
            category: "single_malt",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["exact"],
          },
        ],
      }),
    );

    const actorModule = await import("@peated/server/lib/actors");
    let replacementAttemptId: number | null = null;
    const actorLookup = vi
      .spyOn(actorModule, "getPeatedSystemActor")
      .mockImplementationOnce(async () => {
        const replacementExpiry = new Date(Date.now() + 10 * 60_000);
        await db
          .update(storePriceMatchProposals)
          .set({
            processingToken: "replacement-owner",
            processingQueuedAt: new Date(),
            processingExpiresAt: replacementExpiry,
          })
          .where(eq(storePriceMatchProposals.id, existingProposal.id));
        const [replacementAttempt] = await db
          .insert(storePriceMatchAttempts)
          .values({
            priceId: price.id,
            proposalId: existingProposal.id,
            proposalType: "match_existing",
            initialStatus: "verified",
            suggestedBottleId: bottle.id,
            automationEligible: true,
          })
          .returning();
        replacementAttemptId = replacementAttempt?.id ?? null;

        throw new Error("Simulated retry lease ownership handoff.");
      });

    const resolvedProposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
      processingToken: "lease-token",
    });

    expect(actorLookup).toHaveBeenCalledOnce();
    expect(replacementAttemptId).not.toBeNull();
    expect(resolvedProposal).toMatchObject({
      id: existingProposal.id,
      status: "verified",
      processingToken: "replacement-owner",
    });

    const [updatedProposal, updatedPrice, attempts] = await Promise.all([
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, existingProposal.id),
      }),
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchAttempts.findMany({
        where: eq(storePriceMatchAttempts.proposalId, existingProposal.id),
        orderBy: (attempts, { asc }) => [asc(attempts.id)],
      }),
    ]);

    expect(updatedProposal).toMatchObject({
      status: "verified",
      processingToken: "replacement-owner",
      error: null,
    });
    expect(updatedPrice?.bottleId).toBeNull();
    expect(attempts).toHaveLength(2);
    expect(
      attempts.map(({ finalStatus, reviewedAt, error }) => ({
        finalStatus,
        reviewedAt,
        error,
      })),
    ).toEqual([
      { finalStatus: null, reviewedAt: null, error: null },
      { finalStatus: null, reviewedAt: null, error: null },
    ]);
  });

  test("SMWS classifier creation preserves the parsed cask code in the canonical bottle name", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const site = await fixtures.ExternalSiteOrExisting({ type: "smws" });
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
      shortName: "SMWS",
      type: ["brand", "bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Kyrö",
      type: ["distiller"],
    });
    const mismatchedBottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      distillerIds: [distiller.id],
      name: "Sauna Smoke",
      category: "rye",
      singleCask: true,
    });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      bottleId: null,
      name: "SMWS RW6.5 Sauna Smoke",
      imageUrl: null,
      url: "https://smws.example/rw6-5-name-invariant",
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        extractedLabel: {
          brand: "SMWS",
          bottler: "SMWS",
          expression: "RW6.5 Sauna Smoke",
          series: null,
          distillery: ["Kyrö"],
          category: "rye",
          stated_age: null,
          abv: null,
          release_year: null,
          vintage_year: null,
          cask_type: null,
          cask_size: null,
          cask_fill: null,
          cask_strength: null,
          single_cask: true,
          edition: null,
        },
        decision: {
          action: "create_new",
          confidence: 95,
          rationale:
            "Classifier preserved the SMWS code as the identity anchor.",
          candidateBottleIds: [mismatchedBottle.id],
          proposedBottle: {
            name: "RW6.5 Sauna Smoke",
            series: null,
            category: "rye",
            edition: null,
            statedAge: null,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: brand.id,
              name: "SMWS",
            },
            distillers: [
              {
                id: distiller.id,
                name: "Kyrö",
              },
            ],
            bottler: {
              id: brand.id,
              name: "SMWS",
            },
          },
        },
        searchEvidence: [
          {
            provider: "openai",
            query: "SMWS RW6.5 Sauna Smoke",
            summary:
              "The official SMWS page confirms RW6.5 Sauna Smoke as a rye single cask.",
            results: [
              {
                title: "SMWS RW6.5 Sauna Smoke",
                url: "https://smws.com/rw6-5-sauna-smoke",
                domain: "smws.com",
                description:
                  "SMWS RW6.5 Sauna Smoke is a rye whisky from a single cask.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [
          {
            bottleId: mismatchedBottle.id,
            alias: null,
            fullName: mismatchedBottle.fullName,
            brand: "SMWS",
            bottler: "SMWS",
            series: null,
            distillery: ["Kyrö"],
            category: "rye",
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: true,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.8,
            source: ["text"],
          },
        ],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(extractFromText).not.toHaveBeenCalled();
    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      suggestedBottleId: expect.any(Number),
    });
    expect(proposal.suggestedBottleId).not.toBe(mismatchedBottle.id);
    expect(createdBottle).toMatchObject({
      name: "RW6.5 Sauna Smoke - Single Cask",
      fullName: "SMWS RW6.5 Sauna Smoke - Single Cask",
      brandId: brand.id,
    });
    expect(updatedPrice?.bottleId).toBe(proposal.suggestedBottleId);
  });

  test("auto creates high-confidence web-validated new bottles", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const { queueBottleCreationVerification } =
      await import("@peated/server/lib/catalogVerification");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Auto Create Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Auto Brand",
      bottler: null,
      expression: "Web Reserve",
      series: null,
      distillery: ["Auto Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 92,
          rationale: "Web evidence confirms a distinct release.",
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Web Reserve",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 12,
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
              name: "Auto Brand",
            },
            distillers: [
              {
                id: null,
                name: "Auto Distillery",
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [
          {
            query: '"Auto Brand" "Web Reserve" official',
            summary:
              "The official Auto Brand release page confirms Web Reserve as a 12 year single malt.",
            results: [
              {
                title: "Auto Create Candidate",
                url: "https://www.autobrand.com/web-reserve",
                domain: "autobrand.com",
                description:
                  "The official Auto Brand release page confirms Web Reserve as a 12 year single malt.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const systemActor = await getPeatedSystemActor();
    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });
    const creationChange = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectType, "bottle"),
        eq(changes.objectId, proposal.suggestedBottleId!),
        eq(changes.type, "add"),
      ),
    });
    const [attempt] = await db
      .select()
      .from(storePriceMatchAttempts)
      .where(eq(storePriceMatchAttempts.proposalId, proposal.id));

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      reviewedById: expect.any(Number),
      currentBottleId: expect.any(Number),
      suggestedBottleId: expect.any(Number),
    });
    expect(updatedPrice).toMatchObject({
      bottleId: proposal.suggestedBottleId,
    });
    expect(createdBottle).toMatchObject({
      name: "Web Reserve - 12-year-old",
      fullName: "Auto Brand Web Reserve - 12-year-old",
      statedAge: 12,
      createdByActorId: systemActor.id,
    });
    const createdGroup = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, createdBottle!.groupId!),
    });
    expect(createdGroup).toMatchObject({
      name: "Web Reserve",
      statedAge: null,
    });
    expect(listingAlias?.bottleId).toBe(proposal.suggestedBottleId);
    expect(listingAlias?.assignedByActorId).toBe(systemActor.id);
    expect(creationChange?.actorId).toBe(systemActor.id);
    expect(attempt).toMatchObject({
      automationEligible: true,
      finalStatus: "approved",
      initialStatus: "pending_review",
      proposalType: "create_new",
    });
    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });
    expect(decisionLog).toMatchObject({
      sourceKind: "store_price",
      sourceId: price.id,
      proposalId: proposal.id,
      actorId: systemActor.id,
      decision: "create_bottle",
      bottleId: proposal.suggestedBottleId,
      createdBottle: true,
      createdRelease: false,
      confidence: null,
    });
    expect(queueBottleCreationVerification).toHaveBeenCalledWith({
      bottleId: proposal.suggestedBottleId,
      creationSource: "price_match_automation",
    });
  });

  test("auto creates high-confidence bottles while a retry lease is active", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Retry Auto Create Candidate",
      imageUrl: null,
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Retry Auto Brand",
      bottler: null,
      expression: "Lease Reserve",
      series: null,
      distillery: ["Retry Auto Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 92,
          rationale: "Web evidence confirms a distinct release.",
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Lease Reserve",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 12,
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
              name: "Retry Auto Brand",
            },
            distillers: [
              {
                id: null,
                name: "Retry Auto Distillery",
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [
          {
            query: '"Retry Auto Brand" "Lease Reserve" official',
            summary:
              "The official Retry Auto Brand release page confirms Lease Reserve as a 12 year single malt.",
            results: [
              {
                title: "Retry Auto Brand Lease Reserve",
                url: "https://www.retryautobrand.com/lease-reserve",
                domain: "retryautobrand.com",
                description:
                  "The official Retry Auto Brand release page confirms Lease Reserve as a 12 year single malt.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
      processingToken: "lease-token",
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, existingProposal.id),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });
    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      suggestedBottleId: expect.any(Number),
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      suggestedBottleId: proposal.suggestedBottleId,
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: proposal.suggestedBottleId,
    });
    expect(createdBottle).toMatchObject({
      name: "Lease Reserve - 12-year-old",
      fullName: "Retry Auto Brand Lease Reserve - 12-year-old",
    });
  });

  test("does not auto-reuse an existing Bottle through a noncanonical alias collision", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "Aberfeldy",
      type: ["brand"],
    });
    const distiller = await fixtures.Entity({
      name: "Aberfeldy Distillery",
      type: ["distiller"],
    });
    const attemptedCanonicalName = "Aberfeldy 21-year-old";
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Legacy Reserve",
      category: "single_malt",
      statedAge: 21,
      distillerIds: [distiller.id],
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: attemptedCanonicalName,
      assignmentSource: "legacy",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: attemptedCanonicalName,
      imageUrl: null,
    });

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 95,
          rationale: "Official evidence looks like a distinct bottle.",
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "21-year-old",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 21,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: brand.id,
              name: brand.name,
            },
            distillers: [
              {
                id: distiller.id,
                name: distiller.name,
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [
          {
            query: '"Aberfeldy" "21-year-old" official',
            summary:
              "The official Aberfeldy page confirms Aberfeldy 21-year-old as a single malt whisky.",
            results: [
              {
                title: "Aberfeldy 21 Year Old",
                url: "https://www.aberfeldy.com/21-year-old",
                domain: "aberfeldy.com",
                description:
                  "The official Aberfeldy page confirms Aberfeldy 21-year-old as a single malt whisky.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal).toMatchObject({
      status: "errored",
      proposalType: "create_new",
      currentBottleId: null,
      suggestedBottleId: null,
      error: "Bottle already exists.",
    });
    expect(updatedPrice).toMatchObject({ bottleId: null });
  });

  test("auto creates new bottles even when replacing an existing assignment", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    await fixtures.User({
      username: "dcramer",
      admin: true,
      mod: true,
    });

    const currentBottle = await fixtures.Bottle();
    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: currentBottle.id,
      name: "Replacement Create Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Replacement Brand",
      bottler: null,
      expression: "Fresh Release",
      series: null,
      distillery: ["Replacement Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 92,
          rationale: "Web evidence confirms this is a distinct bottling.",
          confidenceBasis: supportiveWebEvidenceConfidenceBasis,
          suggestedBottleId: null,
          candidateBottleIds: [currentBottle.id],
          proposedBottle: {
            name: "Fresh Release",
            series: null,
            category: "single_malt",
            edition: null,
            statedAge: 12,
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
              name: "Replacement Brand",
            },
            distillers: [
              {
                id: null,
                name: "Replacement Distillery",
              },
            ],
            bottler: null,
          },
        },
        searchEvidence: [
          {
            query: '"Replacement Brand" "Fresh Release" official',
            summary:
              "The official Replacement Brand page confirms Fresh Release from Replacement Distillery as a 12 year single malt release.",
            results: [
              {
                title: "Replacement Create Candidate",
                url: "https://www.replacementbrand.com/fresh-release",
                domain: "replacementbrand.com",
                description:
                  "The official Replacement Brand page confirms Fresh Release from Replacement Distillery as a 12 year single malt release.",
                extraSnippets: [],
              },
            ],
          },
        ],
        candidateBottles: [
          {
            bottleId: currentBottle.id,
            alias: null,
            fullName: currentBottle.fullName,
            brand: null,
            bottler: null,
            series: null,
            distillery: [],
            category: null,
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["current"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const createdBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, proposal.suggestedBottleId!),
    });

    expect(proposal).toMatchObject({
      status: "approved",
      proposalType: "create_new",
      reviewedById: expect.any(Number),
      currentBottleId: expect.any(Number),
      suggestedBottleId: expect.any(Number),
    });
    expect(proposal.suggestedBottleId).not.toBe(currentBottle.id);
    expect(updatedPrice).toMatchObject({
      bottleId: proposal.suggestedBottleId,
    });
    expect(createdBottle).toMatchObject({
      name: "Fresh Release - 12-year-old",
      fullName: "Replacement Brand Fresh Release - 12-year-old",
    });
  });

  test("preserves extracted label and candidates when classification fails", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference, BottleClassificationError } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Classifier Failure Candidate",
    });
    const price = await fixtures.StorePrice({
      name: "Classifier Failure Candidate",
      imageUrl: null,
    });

    const candidateBottles = [
      {
        bottleId: bottle.id,
        alias: "Classifier Failure Candidate",
        fullName: bottle.fullName,
        brand: null,
        bottler: null,
        series: null,
        distillery: [],
        category: null,
        statedAge: null,
        edition: null,
        caskStrength: null,
        singleCask: null,
        abv: null,
        vintageYear: null,
        releaseYear: null,
        caskType: null,
        caskSize: null,
        caskFill: null,
        score: 1,
        source: ["exact"],
      },
    ];

    vi.mocked(classifyBottleReference).mockRejectedValue(
      new BottleClassificationError("Classifier blew up", {
        extractedIdentity: {
          brand: "Failure Brand",
          bottler: null,
          expression: "Reserve",
          series: null,
          distillery: ["Failure Distillery"],
          category: "single_malt",
          stated_age: 12,
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
        candidates: candidateBottles,
      }),
    );

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Failure Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Failure Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("errored");
    expect(proposal.error).toBe("Classifier blew up");
    expect(proposal.extractedLabel).toMatchObject({
      brand: "Failure Brand",
      expression: "Reserve",
      stated_age: 12,
    });
    expect(proposal.candidateBottles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
      ]),
    );
  });

  test("includes decision-relevant structured bottle fields in candidate search text", async () => {
    config.AI_GATEWAY_API_KEY = "test-gateway-key";

    const { getOpenAIEmbedding } =
      await import("@peated/server/lib/openaiEmbeddings");
    vi.mocked(getOpenAIEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy.mockResolvedValue({ rows: [] });

    await searchBottleCandidates({
      query: "Springbank Local Barley",
      brand: "Springbank",
      bottler: "Campbeltown Merchant",
      expression: "Local Barley",
      series: null,
      distillery: ["Springbank"],
      category: "single_malt",
      stated_age: null,
      abv: 59.2,
      cask_type: null,
      cask_size: "port_pipe",
      cask_fill: "1st_fill",
      cask_strength: true,
      single_cask: true,
      edition: "Batch 1",
      vintage_year: 2010,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("2010 vintage"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("2024 release"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("59.2% ABV"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("Campbeltown Merchant"),
    );
    expect(getOpenAIEmbedding).not.toHaveBeenCalledWith(
      expect.stringContaining("port_pipe"),
    );
    expect(getOpenAIEmbedding).not.toHaveBeenCalledWith(
      expect.stringContaining("1st_fill"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("cask strength"),
    );
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      expect.stringContaining("single cask"),
    );
  });

  test("re-ranks local candidates using structured bottle fields", async () => {
    config.AI_GATEWAY_API_KEY = undefined;

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 1",
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: 2010,
            releaseYear: 2024,
            caskType: "bourbon",
            score: 0.82,
          },
          {
            bottleId: 2,
            fullName: "Shibui Pure Malt Single Cask",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 1",
            caskStrength: true,
            singleCask: true,
            abv: 59.2,
            vintageYear: 2010,
            releaseYear: 2024,
            caskType: "bourbon",
            score: 0.8,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const candidates = await searchBottleCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 12,
      abv: 59.2,
      cask_type: "bourbon",
      cask_strength: true,
      single_cask: true,
      edition: "Batch 1",
      vintage_year: 2010,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates[0]).toMatchObject({
      bottleId: 2,
      caskStrength: true,
      singleCask: true,
      abv: 59.2,
    });
  });

  test("penalizes an ordinary Bottle stated-age conflict", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = "test-gateway-key";
    const { getOpenAIEmbedding } =
      await import("@peated/server/lib/openaiEmbeddings");
    const queryEmbedding = [1, ...Array.from({ length: 3071 }, () => 0)];
    const embeddingWithCosineSimilarity = (similarity: number) => [
      similarity,
      Math.sqrt(1 - similarity ** 2),
      ...Array.from({ length: 3070 }, () => 0),
    ];
    vi.mocked(getOpenAIEmbedding).mockResolvedValue(queryEmbedding);

    const brand = await fixtures.Entity({ name: "Age Ranking Evidence" });
    const mismatched = await fixtures.Bottle({
      brandId: brand.id,
      name: "Mismatch Candidate",
      statedAge: 18,
    });
    const matching = await fixtures.Bottle({
      brandId: brand.id,
      name: "Matching Candidate",
      statedAge: 12,
    });
    await db
      .update(bottles)
      .set({ fullName: "Age Ranking Mismatch Candidate" })
      .where(eq(bottles.id, mismatched.id));
    await fixtures.BottleAlias({
      bottleId: mismatched.id,
      name: "Age Ranking Mismatch Alias",
      embedding: embeddingWithCosineSimilarity(0.9),
    });
    await fixtures.BottleAlias({
      bottleId: matching.id,
      name: "Age Ranking Matching Alias",
      embedding: embeddingWithCosineSimilarity(0.72),
    });

    const candidates = await searchBottleCandidates({
      query: "Age Ranking Evidence",
      stated_age: 12,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates[0]?.bottleId).toBe(matching.id);
  });

  test("enriches candidates from the independently complete Bottle", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      name: "Independent Label",
      type: ["brand"],
    });
    const bottler = await fixtures.Entity({
      name: "Campbeltown Merchant",
      type: ["bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Ben Nevis",
      type: ["distiller"],
    });
    const series = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Small Batch",
    });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: bottler.id,
      seriesId: series.id,
      distillerIds: [distiller.id],
      name: "Reserve",
      category: "single_malt",
      statedAge: 12,
      edition: "Batch 7",
      caskStrength: true,
      singleCask: true,
      abv: 57.8,
      vintageYear: 2011,
      releaseYear: 2024,
      caskType: "ruby_port",
      caskSize: "port_pipe",
      caskFill: "1st_fill",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Independent Label Small Batch Reserve Batch 7",
    });
    const [candidate] = await searchBottleCandidates({
      query: "Independent Label Small Batch Reserve Batch 7",
      brand: brand.name,
      bottler: bottler.name,
      expression: "Reserve",
      series: series.name,
      distillery: [distiller.name],
      category: "single_malt",
      stated_age: 12,
      abv: 57.8,
      cask_type: "ruby_port",
      cask_size: "port_pipe",
      cask_fill: "1st_fill",
      cask_strength: true,
      single_cask: true,
      edition: "Batch 7",
      vintage_year: 2011,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidate).toMatchObject({
      bottleId: bottle.id,
      brand: brand.name,
      bottler: bottler.name,
      series: series.name,
      distillery: [distiller.name],
      category: "single_malt",
      statedAge: 12,
      edition: "Batch 7",
      caskStrength: true,
      singleCask: true,
      abv: 57.8,
      vintageYear: 2011,
      releaseYear: 2024,
      caskType: "ruby_port",
      caskSize: "port_pipe",
      caskFill: "1st_fill",
    });
  });

  test("surfaces an exact Distillers Edition Bottle from apostrophe retailer wording without web search", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const lagavulin = await fixtures.Entity({
      name: "Lagavulin",
      shortName: "Lagavulin",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: lagavulin.id,
      distillerIds: [lagavulin.id],
      name: "Distillers Edition 2023 Release",
      category: "single_malt",
      releaseYear: 2023,
    });

    // Blank the text-search vectors so this test exercises the local
    // brand/parent candidate path rather than Postgres full-text matching.
    await db.execute(
      sql`UPDATE ${bottles} SET search_vector = NULL WHERE ${bottles.id} = ${bottle.id}`,
    );
    const candidates = await searchBottleCandidates({
      query:
        "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
      brand: lagavulin.name,
      bottler: null,
      expression: "Distiller's Edition",
      series: null,
      distillery: [lagavulin.name],
      category: "single_malt",
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: 2023,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates[0]).toMatchObject({
      bottleId: bottle.id,
      fullName: bottle.fullName,
      releaseYear: 2023,
      source: expect.arrayContaining(["brand"]),
    });
  });

  test("keeps same-year marketed variants as ordinary Bottle candidates", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const lagavulin = await fixtures.Entity({
      name: "Lagavulin",
      shortName: "Lagavulin",
      type: ["brand", "distiller"],
    });
    const springBottle = await fixtures.Bottle({
      brandId: lagavulin.id,
      distillerIds: [lagavulin.id],
      name: "Distillers Edition 2023 Spring Release",
      category: "single_malt",
      releaseYear: 2023,
    });
    const autumnBottle = await fixtures.Bottle({
      brandId: lagavulin.id,
      distillerIds: [lagavulin.id],
      name: "Distillers Edition 2023 Autumn Release",
      category: "single_malt",
      releaseYear: 2023,
    });

    await db.execute(
      sql`UPDATE ${bottles} SET search_vector = NULL WHERE ${bottles.id} IN (${springBottle.id}, ${autumnBottle.id})`,
    );

    const candidates = await searchBottleCandidates({
      query:
        "Lagavulin Distiller's Edition 2023 Islay Single Malt Scotch Whisky",
      brand: lagavulin.name,
      bottler: null,
      expression: "Distiller's Edition",
      series: null,
      distillery: [lagavulin.name],
      category: "single_malt",
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: 2023,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: springBottle.id,
          fullName: springBottle.fullName,
        }),
        expect.objectContaining({
          bottleId: autumnBottle.id,
          fullName: autumnBottle.fullName,
        }),
      ]),
    );
  });

  test("returns both exact and broader Bottle candidates for age-statement listings", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      name: "The Macallan",
      type: ["brand"],
    });
    const cleanParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Sherry Oak",
      category: "single_malt",
      statedAge: null,
    });
    const dirtyAgeBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Sherry Oak 30-year-old",
      category: "single_malt",
      statedAge: 30,
    });
    await fixtures.BottleAlias({
      bottleId: dirtyAgeBottle.id,
      name: "The Macallan Sherry Oak Single Malt Scotch 30-year-old",
    });

    const candidates = await searchBottleCandidates({
      query: "The Macallan Sherry Oak Single Malt Scotch 30-year-old",
      brand: brand.name,
      bottler: null,
      expression: "Sherry Oak",
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 30,
      abv: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: dirtyAgeBottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
        expect.objectContaining({
          bottleId: cleanParent.id,
        }),
      ]),
    );
  });

  test("finds buggy batch aliases and still surfaces the broader Bottle", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const brand = await fixtures.Entity({
      name: "Penelope",
      type: ["brand"],
    });
    const cleanParent = await fixtures.Bottle({
      brandId: brand.id,
      name: "Bourbon Barrel Strength Straight Bourbon Whiskey",
      category: "bourbon",
      statedAge: null,
      edition: null,
    });
    const legacyBatchBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Bourbon Barrel Strength Straight Bourbon Whiskey (Batch 11)",
      category: "bourbon",
      statedAge: null,
      edition: "Batch 11",
    });
    await fixtures.BottleAlias({
      bottleId: legacyBatchBottle.id,
      name: "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey Batch 11",
    });

    const candidates = await searchBottleCandidates({
      query:
        "Penelope Bourbon Barrel Strength Straight Bourbon Whiskey (Batch 11)",
      brand: brand.name,
      bottler: null,
      expression: "Bourbon Barrel Strength Straight Bourbon Whiskey",
      series: null,
      distillery: [],
      category: "bourbon",
      stated_age: null,
      abv: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 11",
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: legacyBatchBottle.id,
          source: expect.arrayContaining(["exact"]),
        }),
        expect.objectContaining({
          bottleId: cleanParent.id,
        }),
      ]),
    );
  });

  test("does not treat edition substring collisions as matching evidence", async () => {
    config.AI_GATEWAY_API_KEY = undefined;

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt Batch 10",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 10",
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: null,
            releaseYear: 2024,
            caskType: null,
            score: 0.82,
          },
          {
            bottleId: 2,
            fullName: "Shibui Pure Malt Batch 1",
            brand: "Shibui",
            category: "single_malt",
            statedAge: 12,
            edition: "Batch 1",
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: null,
            releaseYear: 2024,
            caskType: null,
            score: 0.8,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const candidates = await searchBottleCandidates({
      query: "Shibui Pure Malt Batch 1 Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: "single_malt",
      stated_age: 12,
      abv: 46,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: "Batch 1",
      vintage_year: null,
      release_year: 2024,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates[0]).toMatchObject({
      bottleId: 2,
      edition: "Batch 1",
    });
  });

  test("ranks same-brand local candidates ahead of cross-brand options", async () => {
    config.AI_GATEWAY_API_KEY = undefined;

    const executeSpy = vi.spyOn(db, "execute") as any;
    executeSpy
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt",
            brand: "Shibui",
            score: 0.82,
          },
          {
            bottleId: 2,
            fullName: "Ichiro's Malt & Grain Single Cask",
            brand: "Ichiro's",
            score: 0.81,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            bottleId: 1,
            fullName: "Shibui Pure Malt",
            brand: "Shibui",
          },
        ],
      });

    const candidates = await searchBottleCandidates({
      query: "Shibui Pure Malt Whisky 750ml",
      brand: "Shibui",
      expression: "Pure Malt",
      series: null,
      distillery: [],
      category: null,
      stated_age: null,
      cask_type: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
      vintage_year: null,
      release_year: null,
      currentBottleId: null,
      limit: 15,
    });

    expect(candidates).toEqual([
      expect.objectContaining({
        bottleId: 1,
        brand: "Shibui",
      }),
      expect.objectContaining({
        bottleId: 2,
        brand: "Ichiro's",
      }),
    ]);
  });

  test("passes a generic Bottle Reference payload into the classifier", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Presearch Candidate",
      imageUrl: null,
    });

    vi.mocked(classifyBottleReference).mockRejectedValue(
      new Error("Classifier blew up before refining candidates"),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(classifyBottleReference).toHaveBeenCalledWith({
      reference: expect.objectContaining({
        id: price.id,
        externalSiteId: price.externalSiteId,
        name: price.name,
        url: price.url ?? null,
        imageUrl: price.imageUrl ?? null,
        currentBottleId: null,
      }),
    });
    expect(proposal.status).toBe("errored");
  });

  test("records price match attempts and moderator outcomes", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const reviewer = await fixtures.User();
    const currentBottle = await fixtures.Bottle();
    const suggestedBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: currentBottle.id,
      name: "Attempt Candidate",
      imageUrl: null,
    });
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 84,
          rationale: "Local evidence supports this bottle.",
          suggestedBottleId: suggestedBottle.id,
          candidateBottleIds: [suggestedBottle.id],
          proposedBottle: null,
        },
        candidateBottles: [
          {
            bottleId: suggestedBottle.id,
            alias: "Attempt Candidate",
            fullName: suggestedBottle.fullName,
            brand: null,
            bottler: null,
            series: null,
            distillery: [],
            category: null,
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["exact"],
          },
        ],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const [attempt] = await db
      .select()
      .from(storePriceMatchAttempts)
      .where(eq(storePriceMatchAttempts.proposalId, proposal.id));

    expect(attempt).toMatchObject({
      priceId: price.id,
      proposalId: proposal.id,
      proposalType: "correction",
      initialStatus: "pending_review",
      finalStatus: null,
      confidence: null,
      currentBottleId: currentBottle.id,
      suggestedBottleId: suggestedBottle.id,
    });

    await ignoreStorePriceMatchProposal({
      proposalId: proposal.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const [reviewedAttempt] = await db
      .select()
      .from(storePriceMatchAttempts)
      .where(eq(storePriceMatchAttempts.id, attempt!.id));

    expect(reviewedAttempt).toMatchObject({
      finalStatus: "ignored",
      reviewedById: reviewer.id,
    });
  });

  test("rejects ignoring a proposal with an actor from another user", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const otherUser = await fixtures.User();
    const price = await fixtures.StorePrice({
      name: "Ignore Mismatch Candidate",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "no_match",
      })
      .returning();

    await expect(
      ignoreStorePriceMatchProposal({
        proposalId: proposal.id,
        reviewedById: reviewer.id,
        actor: await getUserActor(otherUser),
      }),
    ).rejects.toThrow(`does not match user ${reviewer.id}`);

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(updatedProposal).toMatchObject({
      status: "pending_review",
      reviewedById: null,
    });
  });

  test("does not reevaluate closed proposals during automatic resolution", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const price = await fixtures.StorePrice({
      name: "Already Approved Candidate",
    });

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        reviewedById: reviewer.id,
        reviewedAt: new Date("2026-03-10T12:00:00.000Z"),
      })
      .returning();

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");

    const result = await resolveStorePriceMatchProposal(price.id);

    expect(classifyBottleReference).not.toHaveBeenCalled();
    expect(result.id).toBe(proposal.id);
    expect(result.status).toBe("approved");
    expect(result.reviewedById).toBe(reviewer.id);
  });

  test("does not reevaluate reviewable proposals during automatic resolution", async ({
    fixtures,
  }) => {
    const { classifyBottleReference, runBottleReference } =
      await import("@peated/server/agents/bottleClassifier");

    for (const status of ["verified", "pending_review", "errored"] as const) {
      const price = await fixtures.StorePrice({
        name: `Already Classified ${status}`,
      });
      const [proposal] = await db
        .insert(storePriceMatchProposals)
        .values({
          priceId: price.id,
          status,
          proposalType: "no_match",
        })
        .returning();

      const result = await resolveStorePriceMatchProposal(price.id);

      expect(result).toEqual(proposal);
    }

    expect(runBottleReference).not.toHaveBeenCalled();
    expect(classifyBottleReference).not.toHaveBeenCalled();
  });

  test("force reevaluation reopens closed proposals and clears review metadata", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      name: "Retry Candidate",
      imageUrl: null,
    });

    await db.insert(storePriceMatchProposals).values({
      priceId: price.id,
      status: "ignored",
      proposalType: "no_match",
      currentBottleId: bottle.id,
      suggestedBottleId: bottle.id,
      reviewedById: reviewer.id,
      reviewedAt: new Date("2026-03-10T13:00:00.000Z"),
    });

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Retry Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Retry Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 82,
          rationale: "Local alias evidence is now sufficient.",
          suggestedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: "Retry Candidate",
            fullName: bottle.fullName,
            brand: null,
            bottler: null,
            series: null,
            distillery: [],
            category: null,
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 1,
            source: ["exact"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
    });
    const storedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });
    const attempt = await db.query.storePriceMatchAttempts.findFirst({
      where: eq(storePriceMatchAttempts.proposalId, proposal.id),
    });

    expect(classifyBottleReference).toHaveBeenCalledOnce();
    expect(proposal.status).toBe("pending_review");
    expect(proposal.reviewedById).toBeNull();
    expect(proposal.reviewedAt).toBeNull();
    expect(proposal.suggestedBottleId).toBe(bottle.id);
    expect(storedProposal).toMatchObject({
      status: "pending_review",
      reviewedById: null,
      reviewedAt: null,
      suggestedBottleId: bottle.id,
    });
    expect(attempt).toMatchObject({});
  });

  test("persists classifier-reviewed create_new drafts without re-sanitizing them", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Draft Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Draft Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Draft Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 88,
          rationale: "This listing looks like a new bottle.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Reserve",
            series: {
              id: null,
              name: "Special Releases",
            },
            category: "single_malt",
            edition: "Batch 7",
            statedAge: 12,
            caskStrength: true,
            singleCask: true,
            abv: 46,
            vintageYear: null,
            releaseYear: 2024,
            caskType: "bourbon",
            caskSize: "barrel",
            caskFill: "1st_fill",
            brand: {
              id: null,
              name: "Draft Brand",
            },
            distillers: [
              {
                id: null,
                name: "Draft Distillery",
              },
            ],
            bottler: {
              id: null,
              name: "Draft Bottler",
            },
          },
        },
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.proposedBottle).toMatchObject({
      name: "Reserve",
      series: {
        id: null,
        name: "Special Releases",
      },
      brand: {
        id: null,
        name: "Draft Brand",
      },
      distillers: [
        {
          id: null,
          name: "Draft Distillery",
        },
      ],
      bottler: {
        id: null,
        name: "Draft Bottler",
      },
      statedAge: 12,
      edition: "Batch 7",
      caskStrength: true,
      singleCask: true,
      abv: 46,
      releaseYear: 2024,
      caskType: "bourbon",
      caskSize: "barrel",
      caskFill: "1st_fill",
    });
  });

  test("persists classifier-reviewed canonical entity choices on create_new proposals", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const brand = await fixtures.Entity({
      name: "Canonical Brand",
      shortName: "Brand Short",
      type: ["brand"],
    });
    const distiller = await fixtures.Entity({
      name: "Canonical Distillery",
      shortName: "Distillery Short",
      type: ["distiller"],
    });
    const bottler = await fixtures.Entity({
      name: "Canonical Bottler",
      type: ["bottler"],
    });
    await fixtures.EntityAlias({
      entityId: brand.id,
      name: "Brand Alias",
    });
    await fixtures.EntityAlias({
      entityId: bottler.id,
      name: "Bottler Alias",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Validated Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Canonical Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Canonical Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "create_new",
          confidence: 88,
          rationale: "This listing looks like a new bottle.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: {
            name: "Reserve",
            series: {
              id: null,
              name: "Special Releases",
            },
            category: "single_malt",
            edition: null,
            statedAge: 12,
            caskStrength: null,
            singleCask: null,
            abv: 46,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            brand: {
              id: brand.id,
              name: "Canonical Brand",
            },
            distillers: [
              {
                id: distiller.id,
                name: "Canonical Distillery",
              },
            ],
            bottler: {
              id: bottler.id,
              name: "Canonical Bottler",
            },
          },
        },
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [
          {
            entityId: brand.id,
            name: brand.name,
            shortName: brand.shortName,
            type: brand.type,
            alias: "Brand Alias",
            score: 1,
            source: ["exact"],
          },
          {
            entityId: distiller.id,
            name: distiller.name,
            shortName: distiller.shortName,
            type: distiller.type,
            alias: null,
            score: 1,
            source: ["exact"],
          },
          {
            entityId: bottler.id,
            name: bottler.name,
            shortName: bottler.shortName,
            type: bottler.type,
            alias: "Bottler Alias",
            score: 1,
            source: ["exact"],
          },
        ],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("pending_review");
    expect(proposal.proposalType).toBe("create_new");
    expect(proposal.proposedBottle).toMatchObject({
      name: "Reserve",
      series: {
        id: null,
        name: "Special Releases",
      },
      brand: {
        id: brand.id,
        name: "Canonical Brand",
      },
      distillers: [
        {
          id: distiller.id,
          name: "Canonical Distillery",
        },
      ],
      bottler: {
        id: bottler.id,
        name: "Canonical Bottler",
      },
    });
  });

  test("marks proposals errored when classifier suggests an unknown bottle id", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      name: "Unknown Suggested Candidate",
      imageUrl: null,
    });

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Unknown Brand",
      bottler: null,
      expression: "Reserve",
      series: null,
      distillery: ["Unknown Distillery"],
      category: "single_malt",
      stated_age: 12,
      abv: null,
      release_year: null,
      vintage_year: null,
      cask_type: null,
      cask_size: null,
      cask_fill: null,
      cask_strength: null,
      single_cask: null,
      edition: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match_existing",
          confidence: 80,
          rationale: "Looks like an existing bottle.",
          suggestedBottleId: 999999,
          candidateBottleIds: [bottle.id, 999999],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [
          {
            bottleId: bottle.id,
            alias: "Unknown Suggested Candidate",
            fullName: bottle.fullName,
            brand: null,
            bottler: null,
            series: null,
            distillery: [],
            category: null,
            statedAge: null,
            edition: null,
            caskStrength: null,
            singleCask: null,
            abv: null,
            vintageYear: null,
            releaseYear: null,
            caskType: null,
            caskSize: null,
            caskFill: null,
            score: 0.95,
            source: ["exact"],
          },
        ],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal.status).toBe("errored");
    expect(proposal.suggestedBottleId).toBeNull();
    expect(proposal.error).toContain("unknown suggested bottle id");
    expect(proposal.candidateBottles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bottleId: bottle.id,
        }),
      ]),
    );
  });

  test("clears retry processing leases after forced resolution", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { extractFromText } =
      await import("@peated/server/agents/whisky/labelExtractor");
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      name: "Retry Lease Candidate",
      imageUrl: null,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "errored",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    vi.mocked(extractFromText).mockResolvedValue({
      brand: "Retry Brand",
      bottler: null,
      expression: "Retry Lease Candidate",
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
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "no_match",
          confidence: 35,
          rationale: "Still no confident match.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    await resolveStorePriceMatchProposal(price.id, {
      force: true,
      processingToken: "lease-token",
    });

    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(updatedProposal).toMatchObject({
      status: "pending_review",
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
  });

  test("refreshes queue entry time when forced re-resolution requeues a proposal", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      name: "Requeue Candidate",
      imageUrl: null,
    });
    const priorQueueEntryAt = new Date("2026-02-01T00:30:00.000Z");
    const reviewer = await fixtures.User();

    await db.insert(storePriceMatchProposals).values({
      priceId: price.id,
      status: "approved",
      proposalType: "match_existing",
      enteredQueueAt: priorQueueEntryAt,
      reviewedById: reviewer.id,
      reviewedAt: new Date("2026-03-01T00:30:00.000Z"),
    });

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "no_match",
          confidence: 35,
          rationale: "This needs review again.",
          suggestedBottleId: null,
          candidateBottleIds: [],
          proposedBottle: null,
        },
        searchEvidence: [],
        candidateBottles: [],
        resolvedEntities: [],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
    });

    expect(proposal.status).toBe("pending_review");
    expect(proposal.enteredQueueAt).not.toBeNull();
    expect(proposal.enteredQueueAt!.getTime()).toBeGreaterThan(
      priorQueueEntryAt.getTime(),
    );
  });

  test("ignored clear guard requires the active processing lease owner", () => {
    expect(
      canClearIgnoredStorePriceAssignment({
        proposal: {
          processingToken: "lease-token",
          processingExpiresAt: new Date(Date.now() + 60_000),
        },
        processingToken: "lease-token",
      }),
    ).toBe(true);

    expect(
      canClearIgnoredStorePriceAssignment({
        proposal: {
          processingToken: "other-token",
          processingExpiresAt: new Date(Date.now() + 60_000),
        },
        processingToken: "lease-token",
      }),
    ).toBe(false);

    expect(
      canClearIgnoredStorePriceAssignment({
        proposal: {
          processingToken: "lease-token",
          processingExpiresAt: new Date(Date.now() - 60_000),
        },
        processingToken: "lease-token",
      }),
    ).toBe(false);
  });

  test("active ignored-processing owner clears durable identity and releases its lease", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Owned Lease Gift Bundle",
      imageUrl: null,
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      processingToken: "lease-token",
    });
    const [updatedProposal, updatedPrice] = await Promise.all([
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, existingProposal.id),
      }),
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ]);

    expect(proposal.status).toBe("ignored");
    expect(updatedProposal).toMatchObject({
      status: "ignored",
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: null,
    });
  });

  test("replacement owner survives ignored invalid-target recovery with unchanged identity", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Reowned Lease Gift Bundle",
      imageUrl: null,
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "no_match",
        processingToken: "lease-token",
        processingQueuedAt: new Date(Date.now() - 60_000),
        processingExpiresAt: new Date(Date.now() + 10 * 60_000),
      })
      .returning();
    const replacementExpiry = new Date(Date.now() + 20 * 60_000);

    vi.mocked(classifyBottleReference).mockImplementationOnce(async () => {
      await db
        .update(storePriceMatchProposals)
        .set({
          processingToken: "other-owner",
          processingQueuedAt: new Date(),
          processingExpiresAt: replacementExpiry,
        })
        .where(eq(storePriceMatchProposals.id, existingProposal.id));
      await db.insert(bottleTombstones).values({
        bottleId: bottle.id,
        newBottleId: null,
      });

      return buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      });
    });

    const proposal = await resolveStorePriceMatchProposal(price.id, {
      processingToken: "lease-token",
    });
    const [updatedProposal, updatedPrice] = await Promise.all([
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, existingProposal.id),
      }),
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ]);

    expect(proposal).toMatchObject({
      status: "pending_review",
      processingToken: "other-owner",
    });
    expect(updatedProposal).toMatchObject({
      status: "pending_review",
      processingToken: "other-owner",
      processingExpiresAt: replacementExpiry,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: bottle.id,
    });
  });

  test("auto ignored listings preserve unresolved assignment timestamps", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Unresolved Expression Gift Bundle",
      imageUrl: null,
    });
    const evidenceUpdatedAt = new Date("2026-01-02T03:04:05.000Z");
    await db
      .update(storePrices)
      .set({ updatedAt: evidenceUpdatedAt })
      .where(eq(storePrices.id, price.id));

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal).toMatchObject({
      status: "ignored",
      currentBottleId: null,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: null,
    });
    expect(updatedPrice?.updatedAt).toEqual(evidenceUpdatedAt);
  });

  test("ignored listings do not resolve retained retired-Bottle evidence", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Retired Bottle Gift Bundle",
      imageUrl: null,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: null,
    });

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      }),
    );

    await resolveStorePriceMatchProposal(price.id);

    const [updatedPrice, proposal, attempts] = await Promise.all([
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.priceId, price.id),
      }),
      db.query.storePriceMatchAttempts.findMany({
        where: eq(storePriceMatchAttempts.priceId, price.id),
      }),
    ]);
    expect(updatedPrice).toMatchObject({
      bottleId: null,
    });
    expect(proposal).toMatchObject({
      status: "ignored",
      currentBottleId: bottle.id,
    });
    expect(attempts).toHaveLength(1);
  });

  test("serializes ignored Bottle clearing through the StorePrice row", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Bottle Locked Gift Bundle",
      imageUrl: null,
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "no_match",
      })
      .returning();

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      }),
    );

    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let resolution: ReturnType<typeof resolveStorePriceMatchProposal> | null =
      null;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load price blocker pid.");
      await blocker.query(
        "SELECT id FROM store_price WHERE id = $1 FOR UPDATE",
        [price.id],
      );

      resolution = resolveStorePriceMatchProposal(price.id, { force: true });
      void resolution.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await blocker.query("COMMIT");
      blockerReleased = true;
      await resolution;
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (resolution) await resolution.catch(() => undefined);
    }

    const [updatedProposal, updatedPrice, attempts] = await Promise.all([
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, existingProposal.id),
      }),
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchAttempts.findMany({
        where: eq(storePriceMatchAttempts.priceId, price.id),
      }),
    ]);
    expect(updatedProposal?.status).toBe("ignored");
    expect(attempts).toHaveLength(1);
    expect(updatedPrice).toMatchObject({
      bottleId: null,
    });
  });

  test("auto ignored listings preserve a replacement Bottle assigned during classification", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const originalBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: originalBottle.id,
      name: "Bottle Drift Gift Bundle",
      imageUrl: null,
    });

    vi.mocked(classifyBottleReference).mockImplementationOnce(async () => {
      await db
        .update(storePrices)
        .set({ bottleId: replacementBottle.id })
        .where(eq(storePrices.id, price.id));

      return buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      });
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });

    expect(proposal.status).toBe("ignored");
    expect(updatedPrice).toMatchObject({
      bottleId: replacementBottle.id,
    });
  });

  test("continues an ignored proposal when concurrent reassignment retires the stale Bottle", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const originalBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: originalBottle.id,
      name: "Reassigned During Ignore Gift Bundle",
      imageUrl: null,
    });

    vi.mocked(classifyBottleReference).mockImplementationOnce(async () => {
      await db
        .update(storePrices)
        .set({
          bottleId: replacementBottle.id,
        })
        .where(eq(storePrices.id, price.id));
      await db.insert(bottleTombstones).values({
        bottleId: originalBottle.id,
        newBottleId: replacementBottle.id,
      });

      return buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      });
    });

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const [updatedPrice, attempts] = await Promise.all([
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchAttempts.findMany({
        where: eq(storePriceMatchAttempts.priceId, price.id),
      }),
    ]);

    expect(proposal.status).toBe("ignored");
    expect(attempts).toHaveLength(1);
    expect(updatedPrice).toMatchObject({
      bottleId: replacementBottle.id,
    });
  });

  test("preserves a replacement Bottle assigned while ignored clearing waits", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const originalBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: originalBottle.id,
      name: "Hierarchy Retarget Gift Bundle",
      imageUrl: null,
    });

    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      }),
    );

    const hierarchyBlocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let resolution: ReturnType<typeof resolveStorePriceMatchProposal> | null =
      null;
    let hierarchyReleased = false;

    await hierarchyBlocker.connect();
    await observer.connect();
    try {
      await hierarchyBlocker.query("BEGIN");
      const blockerPid = (
        await hierarchyBlocker.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        )
      ).rows[0]?.pid;
      if (!blockerPid) {
        throw new Error("Unable to load hierarchy blocker pid.");
      }
      await hierarchyBlocker.query(
        "SELECT id FROM store_price WHERE id = $1 FOR UPDATE",
        [price.id],
      );

      resolution = resolveStorePriceMatchProposal(price.id);
      void resolution.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await hierarchyBlocker.query(
        `UPDATE store_price
         SET bottle_id = $2
         WHERE id = $1`,
        [price.id, replacementBottle.id],
      );
      await hierarchyBlocker.query(
        `INSERT INTO bottle_tombstone (bottle_id, new_bottle_id)
         VALUES ($1, $2)`,
        [originalBottle.id, replacementBottle.id],
      );
      await hierarchyBlocker.query("COMMIT");
      hierarchyReleased = true;

      const proposal = await resolution;
      expect(proposal.status).toBe("ignored");
    } finally {
      if (!hierarchyReleased) {
        await hierarchyBlocker.query("ROLLBACK").catch(() => undefined);
      }
      await hierarchyBlocker.end();
      await observer.end();
      if (resolution) await resolution.catch(() => undefined);
    }

    const [updatedPrice, proposals, attempts] = await Promise.all([
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchProposals.findMany({
        where: eq(storePriceMatchProposals.priceId, price.id),
      }),
      db.query.storePriceMatchAttempts.findMany({
        where: eq(storePriceMatchAttempts.priceId, price.id),
      }),
    ]);
    expect(updatedPrice).toMatchObject({
      bottleId: replacementBottle.id,
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.status).toBe("ignored");
    expect(attempts).toHaveLength(1);
  });

  test("locks proven identity drift through ignored fallback persistence", async ({
    fixtures,
  }) => {
    config.AI_GATEWAY_API_KEY = undefined;

    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const originalBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: originalBottle.id,
      name: "Fallback Drift Lock Gift Bundle",
      imageUrl: null,
    });
    const [existingProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "no_match",
      })
      .returning();

    vi.mocked(classifyBottleReference).mockImplementationOnce(async () => {
      await db
        .update(storePrices)
        .set({
          bottleId: replacementBottle.id,
        })
        .where(eq(storePrices.id, price.id));
      await db.insert(bottleTombstones).values({
        bottleId: originalBottle.id,
        newBottleId: replacementBottle.id,
      });

      return buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason:
          "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
      });
    });

    const attemptBlocker = new Client(getPostgresConnectionConfig());
    const reverter = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let resolution: ReturnType<typeof resolveStorePriceMatchProposal> | null =
      null;
    let revertUpdate: Promise<unknown> | null = null;
    let attemptBlockerReleased = false;
    let reverterCommitted = false;

    await attemptBlocker.connect();
    await reverter.connect();
    await observer.connect();
    try {
      await attemptBlocker.query("BEGIN");
      const attemptBlockerPid = (
        await attemptBlocker.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        )
      ).rows[0]?.pid;
      if (!attemptBlockerPid) {
        throw new Error("Unable to load attempt blocker pid.");
      }
      await attemptBlocker.query(
        "LOCK TABLE store_price_match_attempt IN ACCESS EXCLUSIVE MODE",
      );

      resolution = resolveStorePriceMatchProposal(price.id, { force: true });
      void resolution.catch(() => undefined);
      const resolverPid = await waitForSessionBlockedBy(
        observer,
        attemptBlockerPid,
      );

      await reverter.query("BEGIN");
      revertUpdate = reverter.query(
        `UPDATE store_price
         SET bottle_id = $2
         WHERE id = $1`,
        [price.id, originalBottle.id],
      );
      await revertUpdate;
      await reverter.query("COMMIT");
      reverterCommitted = true;

      await attemptBlocker.query("COMMIT");
      attemptBlockerReleased = true;
      const proposal = await resolution;

      const persistedProposal = await observer.query<{ status: string }>(
        "SELECT status FROM store_price_match_proposal WHERE id = $1",
        [existingProposal.id],
      );
      expect(proposal.status).toBe("ignored");
      expect(persistedProposal.rows[0]?.status).toBe("ignored");
    } finally {
      if (!attemptBlockerReleased) {
        await attemptBlocker.query("ROLLBACK").catch(() => undefined);
      }
      if (resolution) await resolution.catch(() => undefined);
      if (revertUpdate) await revertUpdate.catch(() => undefined);
      if (!reverterCommitted) {
        await reverter.query("ROLLBACK").catch(() => undefined);
      }
      await attemptBlocker.end();
      await reverter.end();
      await observer.end();
    }

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    expect(updatedPrice).toMatchObject({
      bottleId: null,
    });
  });

  test("approval does not retarget a same-name StorePrice at another volume", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const firstPrice = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Volume Scoped Candidate",
      volume: 750,
    });
    const secondPrice = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Volume Scoped Candidate",
      volume: 1000,
    });
    const [approvedProposal, untouchedProposal] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: firstPrice.id,
          status: "pending_review",
          proposalType: "match_existing",
        },
        {
          priceId: secondPrice.id,
          status: "pending_review",
          proposalType: "match_existing",
        },
      ])
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: approvedProposal.id,
      bottleId: bottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const [updatedFirstPrice, updatedSecondPrice, updatedSecondProposal] =
      await Promise.all([
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, firstPrice.id),
        }),
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, secondPrice.id),
        }),
        db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, untouchedProposal.id),
        }),
      ]);
    expect(updatedFirstPrice).toMatchObject({
      bottleId: bottle.id,
    });
    expect(updatedSecondPrice).toMatchObject({
      bottleId: null,
    });
    expect(updatedSecondProposal).toMatchObject({
      status: "pending_review",
      reviewedById: null,
    });
  });

  test("stores a bottle observation when approving a store price match", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const promotedBottle = await fixtures.Bottle({
      name: "Observation Candidate Batch 7",
      edition: "Batch 7",
      statedAge: 12,
      abv: 55.1,
      caskStrength: true,
      singleCask: true,
      releaseYear: 2024,
      caskType: "bourbon",
      caskSize: "barrel",
      caskFill: "1st_fill",
    });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Observation Candidate",
      url: "https://example.com/observation-candidate",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        extractedLabel: {
          brand: "Observation Brand",
          bottler: null,
          expression: "Reserve",
          series: null,
          distillery: ["Observation Distillery"],
          category: "single_malt",
          stated_age: 12,
          abv: 55.1,
          release_year: 2024,
          vintage_year: null,
          cask_type: "bourbon",
          cask_size: "barrel",
          cask_fill: "1st_fill",
          cask_strength: true,
          single_cask: true,
          edition: "Batch 7",
        },
        proposedBottle: {
          name: "Reserve",
          series: null,
          category: "single_malt",
          edition: "Batch 7",
          statedAge: 12,
          caskStrength: true,
          singleCask: true,
          abv: 55.1,
          vintageYear: null,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
          brand: {
            id: null,
            name: "Observation Brand",
          },
          distillers: [
            {
              id: null,
              name: "Observation Distillery",
            },
          ],
          bottler: null,
        },
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: promotedBottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const observation = await db.query.bottleObservations.findFirst({
      where: (bottleObservations, { eq }) =>
        eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });

    expect(observation).toMatchObject({
      bottleId: promotedBottle.id,
      sourceType: "store_price",
      sourceKey: `store_price:${price.id}`,
      sourceName: price.name,
      sourceUrl: price.url,
      externalSiteId: price.externalSiteId,
      rawText: price.name,
      parsedIdentity: expect.objectContaining({
        brand: "Observation Brand",
        edition: "Batch 7",
        cask_strength: true,
      }),
      facts: expect.objectContaining({
        proposalType: "create_new",
        proposedBottle: expect.objectContaining({
          edition: "Batch 7",
          statedAge: 12,
          abv: 55.1,
          caskStrength: true,
          singleCask: true,
          releaseYear: 2024,
          caskType: "bourbon",
          caskSize: "barrel",
          caskFill: "1st_fill",
        }),
      }),
    });
    expect(observation?.facts).not.toHaveProperty("creationTarget");
    expect(observation?.facts).not.toHaveProperty("releaseFacts");
    expect(observation?.facts).not.toHaveProperty("proposedRelease");

    const decisionLog = await db.query.incomingBottleDecisionLogs.findFirst({
      where: and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.sourceId, price.id),
      ),
    });
    expect(decisionLog).toMatchObject({
      sourceKind: "store_price",
      sourceId: price.id,
      proposalId: proposal.id,
      decision: "match_existing",
      bottleId: promotedBottle.id,
      createdBottle: false,
      createdRelease: false,
    });

    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });
    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    expect(listingAlias).toMatchObject({
      bottleId: promotedBottle.id,
    });
    expect(updatedPrice).toMatchObject({
      bottleId: promotedBottle.id,
    });
  });

  test("reclassification clears stale proposal identity without rewriting attempt evidence", async ({
    fixtures,
  }) => {
    const legacyBottle = await fixtures.Bottle();
    const directBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: directBottle.id,
      name: "Reclassified Direct Bottle",
    });
    const [staleProposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "create_new",
        currentBottleId: legacyBottle.id,
        suggestedBottleId: legacyBottle.id,
      })
      .returning();
    const [attempt] = await db
      .insert(storePriceMatchAttempts)
      .values({
        priceId: price.id,
        proposalId: staleProposal.id,
        proposalType: "create_new",
        initialStatus: "pending_review",
        currentBottleId: legacyBottle.id,
        suggestedBottleId: legacyBottle.id,
      })
      .returning();

    await upsertStorePriceMatchProposal({
      price,
      extractedLabel: null,
      candidates: [],
      decision: {
        action: "match_existing",
        confidence: null,
        rationale: "The direct Bottle is the reviewed match.",
        candidateBottleIds: [directBottle.id],
        identityScope: "product",
        aliasScope: "none",
        suggestedBottleId: directBottle.id,
        proposedBottle: null,
      },
      searchEvidence: [],
    });

    const [updatedProposal, retainedAttempt] = await Promise.all([
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, staleProposal.id),
      }),
      db.query.storePriceMatchAttempts.findFirst({
        where: eq(storePriceMatchAttempts.id, attempt.id),
      }),
    ]);
    expect(updatedProposal).toMatchObject({
      currentBottleId: directBottle.id,
      suggestedBottleId: directBottle.id,
    });
    expect(retainedAttempt).toMatchObject({
      currentBottleId: legacyBottle.id,
      suggestedBottleId: legacyBottle.id,
    });
  });

  test("approves a selected Bottle directly", async ({ fixtures }) => {
    const reviewer = await fixtures.User();
    const parent = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Generic Parent Listing",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "global_alias",
        suggestedBottleId: parent.id,
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: parent.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const [updatedPrice, updatedProposal, listingAlias, observation] =
      await Promise.all([
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, price.id),
        }),
        db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, proposal.id),
        }),
        db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
        }),
        db.query.bottleObservations.findFirst({
          where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
        }),
      ]);

    expect(updatedPrice).toMatchObject({
      bottleId: parent.id,
    });
    expect(updatedProposal).toMatchObject({
      currentBottleId: parent.id,
      suggestedBottleId: parent.id,
    });
    expect(listingAlias).toMatchObject({
      bottleId: parent.id,
    });
    expect(observation).toMatchObject({
      bottleId: parent.id,
    });
  });

  test("reviewer-selected Bottle remains authoritative when stale suggestion evidence changes", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const actor = await getUserActor(reviewer);
    const suggestedParent = await fixtures.Bottle({
      name: "Generic Approval Before Drift",
    });
    const replacementParent = await fixtures.Bottle({
      name: "Generic Approval After Drift",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Generic Approval Identity Drift Listing",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "global_alias",
        suggestedBottleId: suggestedParent.id,
      })
      .returning();

    const blocker = new Client(getPostgresConnectionConfig());
    const mutator = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let approval: ReturnType<typeof applyApprovedStorePriceMatch> | null = null;
    let blockerReleased = false;
    let mutatorCommitted = false;

    await blocker.connect();
    await mutator.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) {
        throw new Error("Unable to load generic approval blocker pid.");
      }
      await blocker.query("SELECT id FROM bottle WHERE id = $1 FOR UPDATE", [
        suggestedParent.id,
      ]);

      approval = applyApprovedStorePriceMatch({
        proposalId: proposal.id,
        bottleId: suggestedParent.id,
        reviewedById: reviewer.id,
        actor,
      });
      void approval.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await mutator.query("BEGIN");
      await mutator.query(
        `UPDATE store_price_match_proposal
         SET suggested_bottle_id = $2
         WHERE id = $1`,
        [proposal.id, replacementParent.id],
      );
      await mutator.query("COMMIT");
      mutatorCommitted = true;

      await blocker.query("COMMIT");
      blockerReleased = true;

      await expect(approval).resolves.toBeUndefined();
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      if (!mutatorCommitted) {
        await mutator.query("ROLLBACK").catch(() => undefined);
      }
      if (approval) await approval.catch(() => undefined);
      await blocker.end();
      await mutator.end();
      await observer.end();
    }

    const [updatedPrice, updatedProposal, alias, observation] =
      await Promise.all([
        db.query.storePrices.findFirst({
          where: eq(storePrices.id, price.id),
        }),
        db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, proposal.id),
        }),
        db.query.bottleAliases.findFirst({
          where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
        }),
        db.query.bottleObservations.findFirst({
          where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
        }),
      ]);

    expect(updatedPrice).toMatchObject({
      id: price.id,
      bottleId: suggestedParent.id,
    });
    expect(updatedProposal).toMatchObject({
      status: "approved",
      currentBottleId: suggestedParent.id,
      suggestedBottleId: suggestedParent.id,
      reviewedById: reviewer.id,
    });
    expect(alias).toMatchObject({ bottleId: suggestedParent.id });
    expect(observation).toMatchObject({
      bottleId: suggestedParent.id,
    });
  });

  test("allows a moderator to select a different active Bottle than the suggestion", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const suggestedParent = await fixtures.Bottle();
    const otherParent = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Unrelated Generic Target",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        suggestedBottleId: suggestedParent.id,
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: otherParent.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const [unchangedPrice, unchangedProposal] = await Promise.all([
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
      db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
    ]);
    expect(unchangedPrice).toMatchObject({
      bottleId: otherParent.id,
    });
    expect(unchangedProposal).toMatchObject({
      status: "approved",
      currentBottleId: otherParent.id,
      suggestedBottleId: otherParent.id,
    });
  });

  test("updates an existing store-price observation", async ({ fixtures }) => {
    const reviewer = await fixtures.User();
    const oldBottle = await fixtures.Bottle();
    const approvedBottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Observation Retarget Assignment",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
      })
      .returning();
    await db.insert(bottleObservations).values({
      bottleId: oldBottle.id,
      sourceType: "store_price",
      sourceKey: `store_price:${price.id}`,
      sourceName: "Stale Observation Assignment",
      createdById: reviewer.id,
    });

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: approvedBottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const observations = await db.query.bottleObservations.findMany({
      where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      bottleId: approvedBottle.id,
      sourceName: price.name,
    });
  });

  test("writes a reusable global alias when the decision asserts global_alias scope", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Global Alias Candidate",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "global_alias",
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: bottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });

    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(listingAlias).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      ignored: false,
    });
    const observation = await db.query.bottleObservations.findFirst({
      where: eq(bottleObservations.sourceKey, `store_price:${price.id}`),
    });
    expect(observation?.bottleId).toBe(bottle.id);
  });

  test("does not globalize the listing title when alias scope is none", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Generic None Scope Candidate",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "none",
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: bottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });

    expect(updatedPrice?.bottleId).toBe(bottle.id);
    expect(listingAlias).toMatchObject({
      bottleId: bottle.id,
      ignored: true,
    });
  });

  test("treats missing alias scope conservatively and keeps the listing title source-scoped", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Missing Scope Candidate",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: bottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });

    expect(listingAlias?.bottleId).toBe(bottle.id);
    expect(listingAlias?.ignored).toBe(true);
  });

  test("leaves other aliases reusable when a none-scope listing is approved", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const canonicalAlias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Canonical Reusable Alias",
      assignmentSource: "canonical",
    });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Unrelated Generic Listing",
      volume: 750,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "none",
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: bottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const reloadedCanonical = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, canonicalAlias.name),
    });
    expect(reloadedCanonical?.ignored).toBe(false);
  });

  test("keeps an existing active alias reusable when a none-scope proposal is approved", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Existing Active Alias Listing",
      volume: 750,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: normalizeBottleAliasKey(price.name),
      assignmentSource: "human_approved",
      ignored: false,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "none",
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: bottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });

    // A none-scope decision must not deactivate an accepted alias that already
    // assigns this target for future exact matches.
    expect(listingAlias).toMatchObject({
      bottleId: bottle.id,
      ignored: false,
    });
  });

  test("does not resurrect a moderator-ignored alias when a global_alias proposal is approved", async ({
    fixtures,
  }) => {
    const reviewer = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "Existing Ignored Alias Listing",
      volume: 750,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: normalizeBottleAliasKey(price.name),
      assignmentSource: "human_approved",
      ignored: true,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
        aliasScope: "global_alias",
      })
      .returning();

    await applyApprovedStorePriceMatch({
      proposalId: proposal.id,
      bottleId: bottle.id,
      reviewedById: reviewer.id,
      actor: await getUserActor(reviewer),
    });

    const listingAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, normalizeBottleAliasKey(price.name)),
    });

    // The classifier's alias scope cannot upgrade human state: a moderator
    // deliberately ignored this alias, so approval keeps it ignored.
    expect(listingAlias).toMatchObject({
      bottleId: bottle.id,
      ignored: true,
    });
  });

  test("persists a linked Bottle check by default", async ({ fixtures }) => {
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Shadow Disabled Reference",
      imageUrl: null,
    });
    const candidate = await getBottleCandidateById(bottle.id);
    expect(candidate).not.toBeNull();
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match",
          rationale: "The source matches the inspected Bottle.",
          candidateBottleIds: [bottle.id],
          aliasScope: "none",
          matchedBottleId: bottle.id,
          proposedBottle: null,
        },
        candidateBottles: [candidate],
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);

    expect(proposal).toMatchObject({
      status: "pending_review",
      proposalType: "match_existing",
      suggestedBottleId: bottle.id,
    });
    expect(await db.select().from(storePriceMatchAttempts)).toHaveLength(1);
    expect(await db.select().from(bottleChecks)).toEqual([
      expect.objectContaining({
        intent: "resolve_reference",
        sourceKind: "store_price",
        sourceId: String(price.id),
        storePriceMatchProposalId: proposal.id,
      }),
    ]);
    const check = await db.query.bottleChecks.findFirst({
      where: eq(bottleChecks.storePriceMatchProposalId, proposal.id),
      with: { operations: true },
    });
    expect(check?.operations).toEqual([]);
  });

  test("links every classified full retry to an immutable identity check", async ({
    fixtures,
  }) => {
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const { runScrapedBottleReference } =
      await import("@peated/server/agents/bottleClassifier/scrapedBottleReference");
    const sourceBottle = await fixtures.Bottle({ name: "Duplicate Source" });
    const destinationBottle = await fixtures.Bottle({
      name: "Canonical Destination",
    });
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Classified Shadow Reference",
      imageUrl: null,
    });
    const sourceCandidate = await getBottleCandidateById(sourceBottle.id);
    const destinationCandidate = await getBottleCandidateById(
      destinationBottle.id,
    );
    expect(sourceCandidate).not.toBeNull();
    expect(destinationCandidate).not.toBeNull();
    const sourceContext = await inspectedBottleContext(sourceBottle.id);
    const destinationContext = await inspectedBottleContext(
      destinationBottle.id,
    );
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        decision: {
          action: "match",
          rationale: "The source matches the canonical destination.",
          candidateBottleIds: [sourceBottle.id, destinationBottle.id],
          aliasScope: "none",
          matchedBottleId: destinationBottle.id,
          proposedBottle: null,
        },
        candidateBottles: [sourceCandidate, destinationCandidate],
        bottleContexts: [sourceContext, destinationContext],
      }),
    );
    const modelMetadata = {
      agentDurationMs: 321,
      usage: {
        requests: 2,
        inputTokens: 1_000,
        outputTokens: 200,
        totalTokens: 1_200,
      },
      toolCalls: {
        count: 2,
        names: ["search_bottles", "get_bottle_context"],
      },
    };
    vi.mocked(runScrapedBottleReference).mockImplementation(
      async (...args) => ({
        result: await vi.mocked(classifyBottleReference)(...args),
        modelMetadata,
      }),
    );

    const firstProposal = await resolveStorePriceMatchProposal(price.id);
    const secondProposal = await resolveStorePriceMatchProposal(price.id, {
      force: true,
    });

    expect(secondProposal).toMatchObject({
      id: firstProposal.id,
      status: "pending_review",
      proposalType: "match_existing",
      suggestedBottleId: destinationBottle.id,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null });

    const attempts = await db.query.storePriceMatchAttempts.findMany({
      where: eq(storePriceMatchAttempts.proposalId, firstProposal.id),
    });
    const checks = await db.query.bottleChecks.findMany({
      where: eq(bottleChecks.storePriceMatchProposalId, firstProposal.id),
      with: { operations: true },
    });
    expect(attempts).toHaveLength(2);
    expect(checks).toHaveLength(2);
    expect(
      checks.map(({ storePriceMatchAttemptId }) => storePriceMatchAttemptId),
    ).toEqual(expect.arrayContaining(attempts.map(({ id }) => id)));
    expect(classifyBottleReference).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
    );
    expect(classifyBottleReference).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
    );
    for (const check of checks) {
      expect(check).toMatchObject({
        intent: "resolve_reference",
        sourceKind: "store_price",
        sourceId: String(price.id),
        output: {
          status: "classified",
          decision: {
            action: "match",
            matchedBottleId: destinationBottle.id,
          },
        },
        modelMetadata,
      });
      expect(check.operations).toEqual([]);
    }
  });

  test("links ignored results to their attempt without changing ignored behavior", async ({
    fixtures,
  }) => {
    const { classifyBottleReference } =
      await import("@peated/server/agents/bottleClassifier");
    const assignedBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: assignedBottle.id,
      name: "Ignored Shadow Bundle",
      imageUrl: null,
    });
    vi.mocked(classifyBottleReference).mockResolvedValue(
      buildMockBottleReferenceClassification({
        status: "ignored",
        ignoreReason: "The source is a multi-bottle bundle.",
      }),
    );

    const proposal = await resolveStorePriceMatchProposal(price.id);
    const attempt = await db.query.storePriceMatchAttempts.findFirst({
      where: eq(storePriceMatchAttempts.proposalId, proposal.id),
    });
    const check = await db.query.bottleChecks.findFirst({
      where: eq(bottleChecks.storePriceMatchAttemptId, attempt!.id),
      with: { operations: true },
    });

    expect(proposal).toMatchObject({
      status: "ignored",
      proposalType: "no_match",
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(check).toMatchObject({
      intent: "resolve_reference",
      sourceKind: "store_price",
      sourceId: String(price.id),
      storePriceMatchProposalId: proposal.id,
      storePriceMatchAttemptId: attempt!.id,
      output: {
        status: "ignored",
        reason: "The source is a multi-bottle bundle.",
      },
      operations: [],
    });
  });
});
