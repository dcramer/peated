import {
  buildBottleClassificationArtifacts,
  createAuditBottleResult,
} from "@peated/bottle-classifier/contract";
import { runBottleAudit as auditBottleWithServerAdapters } from "@peated/server/agents/bottleClassifier/service";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  bottles,
  changes,
} from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { afterEach, vi } from "vitest";
import verifyBottleCreation from "./verifyBottleCreation";

vi.mock("@peated/server/agents/bottleClassifier/service", () => {
  return {
    runBottleAudit: vi.fn(),
    classifyBottleReference: vi.fn(),
    identifyExistingBottleReference: vi.fn(),
  };
});

describe("verifyBottleCreation", () => {
  afterEach(() => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = false;
    vi.resetAllMocks();
  });

  test("records flagged findings for suspicious manually created bottles", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand", "distiller"],
    });
    await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
      totalBottles: 12,
    });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Reserve 9-year-old Triple Aged",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Canadian Club Reserve 9-year-old Triple Aged",
    });

    await verifyBottleCreation({
      bottleId: bottle.id,
      creationSource: "manual_entry",
    });

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    const verificationChange = bottleChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );

    expect(verificationChange?.data.catalogVerification).toMatchObject({
      source: "manual_entry",
      status: "flagged",
    });
    expect(
      verificationChange?.data.catalogVerification.findings.map(
        (finding: { kind: string }) => finding.kind,
      ),
    ).toContain("brand_repair_candidate");
  });

  test("records skipped results for trusted creation flows", async ({
    fixtures,
  }) => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = true;
    const bottle = await fixtures.Bottle();

    await verifyBottleCreation({
      bottleId: bottle.id,
      creationSource: "price_match_review",
    });

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    const verificationChange = bottleChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );

    expect(verificationChange?.data.catalogVerification).toMatchObject({
      source: "price_match_review",
      status: "skipped",
    });
    expect(auditBottleWithServerAdapters).not.toHaveBeenCalled();
  });

  test("replaces selected Bottle verification with one review-only audit check", async ({
    fixtures,
  }) => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = true;
    const bottle = await fixtures.Bottle({ edition: null });
    const { getBottleClassifierContext } =
      await import("@peated/server/agents/bottleClassifier/contextAdapters");
    const bottleContext = await getBottleClassifierContext(bottle.id);
    if (!bottleContext) {
      throw new Error(`Bottle ${bottle.id} context was not found.`);
    }
    const { imageSources: _imageSources, ...contextFields } = bottleContext;

    vi.mocked(auditBottleWithServerAdapters).mockResolvedValue({
      result: createAuditBottleResult({
        summary: "The edition should be corrected.",
        proposedOperations: [
          {
            type: "update_bottle",
            input: {
              bottleId: bottle.id,
              patch: { exact: { edition: "Audited Edition" } },
            },
            rationale: "The inspected Bottle has a missing edition.",
            evidenceRefs: [{ kind: "bottle", bottleId: bottle.id }],
          },
        ],
        findings: [],
        artifacts: buildBottleClassificationArtifacts({
          bottleContexts: [{ ...contextFields, publicImages: [] }],
        }),
      }),
      modelMetadata: null,
    });

    const input = {
      bottleId: bottle.id,
      creationSource: "manual_entry" as const,
    };
    await verifyBottleCreation(input);
    await verifyBottleCreation(input);

    expect(auditBottleWithServerAdapters).toHaveBeenCalledTimes(1);
    expect(auditBottleWithServerAdapters).toHaveBeenCalledWith({
      bottleId: bottle.id,
      origin: "post_user_creation",
    });

    const checks = await db
      .select()
      .from(bottleChecks)
      .where(
        eq(bottleChecks.backgroundEventKey, `bottle_created:${bottle.id}`),
      );
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({
      intent: "audit_bottle",
      origin: "post_user_creation",
      bottleId: bottle.id,
    });

    const operations = await db
      .select()
      .from(bottleOperations)
      .where(eq(bottleOperations.checkId, checks[0]!.id));
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      status: "pending_review",
      proposal: { type: "update_bottle" },
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, bottle.id),
        columns: { edition: true },
      }),
    ).toEqual({ edition: null });

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    expect(
      bottleChanges.some(
        (change) => change.data?.catalogVerification?.phase === "result",
      ),
    ).toBe(false);
  });

  test("fails for retry without falling back to the old heuristic conclusion", async ({
    fixtures,
  }) => {
    config.BOTTLE_CHECK_SHADOW_GENERATION = true;
    const bottle = await fixtures.Bottle();
    vi.mocked(auditBottleWithServerAdapters).mockRejectedValue(
      new Error("classifier unavailable"),
    );

    await expect(
      verifyBottleCreation({
        bottleId: bottle.id,
        creationSource: "manual_entry",
      }),
    ).rejects.toThrow("classifier unavailable");

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    expect(
      bottleChanges.some(
        (change) => change.data?.catalogVerification?.phase === "result",
      ),
    ).toBe(false);
    expect(
      await db
        .select({ id: bottleChecks.id })
        .from(bottleChecks)
        .where(
          eq(bottleChecks.backgroundEventKey, `bottle_created:${bottle.id}`),
        ),
    ).toEqual([]);
  });
});
