import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import { getOpenAIEmbedding } from "@peated/server/lib/openaiEmbeddings";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import indexBottleAlias from "./indexBottleAlias";

vi.mock("@peated/server/lib/openaiEmbeddings", () => ({
  getOpenAIEmbedding: vi.fn(),
}));

const EMBEDDING = Array.from({ length: 3072 }, () => 0.125);

describe("indexBottleAlias", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("builds an exact alias embedding only from its authoritative target Bottle", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Target Bottle Brand",
      shortName: "TBB",
    });
    const targetBottle = await fixtures.Bottle({
      name: "Target Expression",
      brandId: brand.id,
      category: "single_malt",
      edition: "Target Edition Solstice",
      statedAge: 19,
      caskType: "oloroso",
      caskStrength: true,
      singleCask: true,
      vintageYear: 1998,
      releaseYear: 2018,
      abv: 57.4,
    });
    const retainedBottle = await fixtures.Bottle({
      name: "Unrelated Retained Bottle",
    });
    const retainedRelease = await fixtures.BottleRelease({
      bottleId: retainedBottle.id,
      edition: "Legacy Pair Eclipse",
      statedAge: 40,
      vintageYear: 1970,
    });
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, targetBottle.id),
    });
    if (!exactTarget) throw new Error("Exact CatalogTarget fixture not found.");

    const alias = await fixtures.BottleAlias({
      name: "Authoritative Alias Aurora",
      bottleId: retainedBottle.id,
      releaseId: retainedRelease.id,
      targetId: exactTarget.id,
      ignored: false,
    });
    vi.mocked(getOpenAIEmbedding).mockResolvedValue(EMBEDDING);

    await indexBottleAlias({ name: alias.name.toUpperCase() });

    expect(getOpenAIEmbedding).toHaveBeenCalledOnce();
    expect(getOpenAIEmbedding).toHaveBeenCalledWith(
      "Target Bottle Brand Authoritative Alias Aurora Single Malt Target Edition Solstice 19-year-old oloroso cask strength barrel strength barrel proof full proof natural strength single cask single barrel 1998 vintage 2018 release 57.4% ABV",
    );
    expect(getOpenAIEmbedding).not.toHaveBeenCalledWith(
      expect.stringContaining("Legacy Pair Eclipse"),
    );
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ embedding: expect.anything() });
  });

  test("clears embeddings for generic, ignored, targetless, and inactive aliases", async ({
    fixtures,
  }) => {
    const genericBottle = await fixtures.Bottle({ name: "Generic Source" });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, genericBottle.groupId!),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) {
      throw new Error("Generic CatalogTarget fixture not found.");
    }
    const genericAlias = await fixtures.BottleAlias({
      name: "Generic Alias",
      bottleId: genericBottle.id,
      targetId: genericTarget.id,
      ignored: false,
      embedding: EMBEDDING,
    });

    const ignoredBottle = await fixtures.Bottle({ name: "Ignored Source" });
    const ignoredTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, ignoredBottle.id),
    });
    if (!ignoredTarget) {
      throw new Error("Ignored exact CatalogTarget fixture not found.");
    }
    const ignoredAlias = await fixtures.BottleAlias({
      name: "Ignored Alias",
      bottleId: ignoredBottle.id,
      targetId: ignoredTarget.id,
      ignored: true,
      embedding: EMBEDDING,
    });

    const targetlessBottle = await fixtures.Bottle({
      name: "Targetless Source",
    });
    const targetlessAlias = await fixtures.BottleAlias({
      name: "Targetless Alias",
      bottleId: targetlessBottle.id,
      targetId: null,
      ignored: false,
      embedding: EMBEDDING,
    });

    const inactiveBottle = await fixtures.Bottle({ name: "Inactive Source" });
    const inactiveTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, inactiveBottle.id),
    });
    if (!inactiveTarget) {
      throw new Error("Inactive exact CatalogTarget fixture not found.");
    }
    const inactiveAlias = await fixtures.BottleAlias({
      name: "Inactive Alias",
      bottleId: inactiveBottle.id,
      targetId: inactiveTarget.id,
      ignored: false,
      embedding: EMBEDDING,
    });
    const replacement = await fixtures.Bottle({ name: "Active Replacement" });
    await db.insert(bottleTombstones).values({
      bottleId: inactiveBottle.id,
      newBottleId: replacement.id,
    });

    const aliases = [
      genericAlias,
      ignoredAlias,
      targetlessAlias,
      inactiveAlias,
    ];
    for (const alias of aliases) {
      await indexBottleAlias({ name: alias.name });
    }

    expect(getOpenAIEmbedding).not.toHaveBeenCalled();
    expect(
      await db
        .select({
          name: bottleAliases.name,
          embedding: bottleAliases.embedding,
        })
        .from(bottleAliases)
        .where(
          inArray(
            bottleAliases.name,
            aliases.map(({ name }) => name),
          ),
        )
        .orderBy(asc(bottleAliases.name)),
    ).toEqual(
      aliases
        .map(({ name }) => ({ name, embedding: null }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  });

  test("rejects an unknown alias name", async () => {
    await expect(
      indexBottleAlias({ name: "Unknown Alias Name" }),
    ).rejects.toThrow("Unknown bottle alias: Unknown Alias Name");
    expect(getOpenAIEmbedding).not.toHaveBeenCalled();
  });
});
