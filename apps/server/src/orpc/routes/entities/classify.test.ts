import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { afterEach, describe, expect, test, vi } from "vitest";

const classifyEntityMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/agents/entityClassifier", () => ({
  classifyEntity: classifyEntityMock,
}));

describe("POST /entities/{entity}/classify", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.entities.classify(
        {
          entity: 1,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns not found for an unknown entity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.entities.classify(
        {
          entity: 999999,
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });

  test("runs the classifier against the reconstructed entity reference", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand", "distiller"],
    });
    const canadianClub = await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
      totalBottles: 12,
      totalTastings: 180,
    });
    const user = await fixtures.User({ mod: true });
    const reserveBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Reserve 9-year-old Triple Aged",
      totalTastings: 9,
    });
    await fixtures.BottleAlias({
      bottleId: reserveBottle.id,
      name: "Canadian Club Reserve 9-year-old Triple Aged",
    });

    classifyEntityMock.mockResolvedValue({
      decision: {
        verdict: "reassign_bottles_to_existing_brand",
        confidence: 97,
        rationale: "Bottle evidence supports Canadian Club.",
        targetEntityId: canadianClub.id,
        targetEntityName: canadianClub.name,
        reassignBottleIds: [reserveBottle.id],
        preserveSourceAsDistillery: true,
        metadataPatch: {},
        blockers: [],
        evidenceUrls: [],
      },
      artifacts: {
        resolvedEntities: [],
        searchEvidence: [],
      },
    });

    const result = await routerClient.entities.classify(
      {
        entity: currentBrand.id,
      },
      { context: { user } },
    );

    expect(result.decision).toMatchObject({
      verdict: "reassign_bottles_to_existing_brand",
      targetEntityId: canadianClub.id,
    });
    expect(classifyEntityMock).toHaveBeenCalledWith({
      reference: expect.objectContaining({
        entity: expect.objectContaining({
          id: currentBrand.id,
          name: "Canadian",
          aliases: expect.arrayContaining(["Canadian"]),
        }),
        reasons: expect.arrayContaining([
          expect.objectContaining({
            kind: "brand_repair_group",
          }),
        ]),
        candidateTargets: expect.arrayContaining([
          expect.objectContaining({
            entityId: canadianClub.id,
            supportingBottleIds: [reserveBottle.id],
          }),
        ]),
      }),
    });
  });
});
