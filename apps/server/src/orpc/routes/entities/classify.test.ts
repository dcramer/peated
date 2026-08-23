import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import type { Context } from "@peated/server/orpc/context";
import {
  createEntityClassifyProcedure,
  type EntityClassifier,
} from "@peated/server/orpc/routes/entities/classify";
import { beforeEach, describe, expect, test, vi } from "vitest";

const classifyEntity = vi.fn<EntityClassifier>();

function createEntityClassifyClient(context: Context) {
  return createRouterClient(
    { classify: createEntityClassifyProcedure(classifyEntity) },
    { context },
  );
}

describe("POST /entities/{entity}/classify", () => {
  beforeEach(() => {
    classifyEntity.mockReset();
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      createEntityClassifyClient({ user }).classify({
        entity: 1,
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns not found for an unknown entity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(
      createEntityClassifyClient({ user }).classify({
        entity: 999999,
      }),
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

    classifyEntity.mockResolvedValue({
      advice: {
        kind: "brand_assignment_issue",
        summary: "Bottle evidence supports Canadian Club.",
        targetEntityId: canadianClub.id,
        evidenceUrls: [],
      },
      artifacts: {
        resolvedEntities: [],
        searchEvidence: [],
      },
    });

    const result = await createEntityClassifyClient({ user }).classify({
      entity: currentBrand.id,
    });

    expect(result.advice).toMatchObject({
      kind: "brand_assignment_issue",
      targetEntityId: canadianClub.id,
    });
    expect(classifyEntity).toHaveBeenCalledWith({
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
