import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  bottles,
  entities,
} from "@peated/server/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import type { JobPayload } from "../types";
import {
  indexBottleAlias as indexBottleAliasWithServices,
  type IndexBottleAliasServices,
} from "./indexBottleAlias";

let createEmbedding: ReturnType<
  typeof vi.fn<IndexBottleAliasServices["createEmbedding"]>
>;

function indexBottleAlias(input: JobPayload) {
  return indexBottleAliasWithServices(input, { createEmbedding });
}

const EMBEDDING = Array.from({ length: 3072 }, () => 0.125);
const FRESH_EMBEDDING = Array.from({ length: 3072 }, () => 0.5);

function firstEmbeddingValue(
  embedding: number[] | string | null,
): number | null {
  if (embedding === null) return null;
  if (Array.isArray(embedding)) return Number(embedding[0]);
  const serializedEmbedding = z.string().safeParse(embedding);
  if (serializedEmbedding.success) {
    return Number(serializedEmbedding.data.slice(1).split(",", 1)[0]);
  }
  throw new Error("Unexpected pgvector representation.");
}

async function getFirstStoredEmbeddingValue(name: string) {
  const alias = await db.query.bottleAliases.findFirst({
    where: eq(bottleAliases.name, name),
    columns: { embedding: true },
  });
  if (!alias) throw new Error("Bottle alias fixture not found.");
  return firstEmbeddingValue(alias.embedding);
}

describe("indexBottleAlias", () => {
  beforeEach(() => {
    createEmbedding = vi.fn();
  });

  test("builds search text from the directly assigned Bottle", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Direct Bottle Brand",
      shortName: "DBB",
    });
    const bottle = await fixtures.Bottle({
      name: "Direct Expression",
      brandId: brand.id,
      category: "single_malt",
      edition: "Solstice",
      statedAge: 19,
      caskType: "oloroso",
      caskStrength: true,
      singleCask: true,
      vintageYear: 1998,
      releaseYear: 2018,
      abv: 57.4,
    });
    const alias = await fixtures.BottleAlias({
      name: "Authoritative Alias Aurora",
      bottleId: bottle.id,
      ignored: false,
      embedding: EMBEDDING,
    });
    createEmbedding.mockImplementation(async () => {
      expect(await getFirstStoredEmbeddingValue(alias.name)).toBeNull();
      return FRESH_EMBEDDING;
    });

    await indexBottleAlias({ name: alias.name.toUpperCase() });

    expect(createEmbedding).toHaveBeenCalledOnce();
    expect(createEmbedding).toHaveBeenCalledWith(
      "Direct Bottle Brand Authoritative Alias Aurora Single Malt Solstice 19-year-old oloroso cask strength barrel strength barrel proof full proof natural strength single cask single barrel 1998 vintage 2018 release 57.4% ABV",
    );
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ embedding: expect.anything() });
  });

  test("clears ignored, unbound, and inactive alias embeddings", async ({
    fixtures,
  }) => {
    const ignoredBottle = await fixtures.Bottle();
    const ignoredAlias = await fixtures.BottleAlias({
      name: "Ignored Alias",
      bottleId: ignoredBottle.id,
      ignored: true,
      embedding: EMBEDDING,
    });
    const unboundAlias = await fixtures.BottleAlias({
      name: "Unbound Alias",
      bottleId: null,
      embedding: EMBEDDING,
    });
    const unassignedBottle = await fixtures.LegacyBottle();
    const unassignedAlias = await fixtures.BottleAlias({
      name: "Unassigned Bottle Alias",
      bottleId: unassignedBottle.id,
      embedding: EMBEDDING,
    });
    const retiredBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const retiredAlias = await fixtures.BottleAlias({
      name: "Retired Bottle Alias",
      bottleId: retiredBottle.id,
      embedding: EMBEDDING,
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });
    const aliases = [ignoredAlias, unboundAlias, unassignedAlias, retiredAlias];

    for (const alias of aliases) {
      await indexBottleAlias({ name: alias.name });
    }

    expect(createEmbedding).not.toHaveBeenCalled();
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

  test("does not write a stale embedding after direct ownership changes", async ({
    fixtures,
  }) => {
    const originalBottle = await fixtures.Bottle();
    const reassignedBottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      name: "Concurrently Reassigned Alias",
      bottleId: originalBottle.id,
      embedding: EMBEDDING,
    });
    createEmbedding
      .mockImplementationOnce(async () => {
        await db
          .update(bottleAliases)
          .set({ bottleId: reassignedBottle.id, embedding: null })
          .where(eq(bottleAliases.name, alias.name));
        return EMBEDDING;
      })
      .mockResolvedValue(FRESH_EMBEDDING);

    await indexBottleAlias({ name: alias.name });

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ bottleId: reassignedBottle.id });
    expect(await getFirstStoredEmbeddingValue(alias.name)).toBe(0.5);
  });

  test("retries when Bottle search fields drift during generation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: "Original Edition" });
    const alias = await fixtures.BottleAlias({
      name: "Bottle Source Drift Alias",
      bottleId: bottle.id,
      embedding: null,
    });
    createEmbedding
      .mockImplementationOnce(async () => {
        await db
          .update(bottles)
          .set({ edition: "Revised Edition" })
          .where(eq(bottles.id, bottle.id));
        return EMBEDDING;
      })
      .mockResolvedValue(FRESH_EMBEDDING);

    await indexBottleAlias({ name: alias.name });

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(createEmbedding).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Original Edition"),
    );
    expect(createEmbedding).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("Revised Edition"),
    );
    expect(await getFirstStoredEmbeddingValue(alias.name)).toBe(0.5);
  });

  test("retries when brand search fields drift during generation", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Original Search Brand",
      shortName: "OSB",
    });
    const bottle = await fixtures.Bottle({ brandId: brand.id });
    const alias = await fixtures.BottleAlias({
      name: "Brand Source Drift Alias",
      bottleId: bottle.id,
      embedding: null,
    });
    createEmbedding
      .mockImplementationOnce(async () => {
        await db
          .update(entities)
          .set({ name: "Revised Search Brand" })
          .where(eq(entities.id, brand.id));
        return EMBEDDING;
      })
      .mockResolvedValue(FRESH_EMBEDDING);

    await indexBottleAlias({ name: alias.name });

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(createEmbedding).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Original Search Brand"),
    );
    expect(createEmbedding).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("Revised Search Brand"),
    );
    expect(await getFirstStoredEmbeddingValue(alias.name)).toBe(0.5);
  });

  test("does not let an older job overwrite a newer source embedding", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: "Earlier Edition" });
    const alias = await fixtures.BottleAlias({
      name: "Out Of Order Source Alias",
      bottleId: bottle.id,
      embedding: null,
    });
    let signalFirstStarted!: () => void;
    let resolveFirstEmbedding!: (embedding: number[]) => void;
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    const firstEmbedding = new Promise<number[]>((resolve) => {
      resolveFirstEmbedding = resolve;
    });
    createEmbedding
      .mockImplementationOnce(async () => {
        signalFirstStarted();
        return firstEmbedding;
      })
      .mockResolvedValueOnce(FRESH_EMBEDDING)
      .mockRejectedValue(new Error("Redundant generation should not run"));

    const olderJob = indexBottleAlias({ name: alias.name });
    await firstStarted;
    await db
      .update(bottles)
      .set({ edition: "Newer Edition" })
      .where(eq(bottles.id, bottle.id));
    await indexBottleAlias({ name: alias.name });
    resolveFirstEmbedding(EMBEDDING);
    await olderJob;

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(createEmbedding).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Earlier Edition"),
    );
    expect(createEmbedding).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("Newer Edition"),
    );
    expect(await getFirstStoredEmbeddingValue(alias.name)).toBe(0.5);
  });

  test("fails closed after two consecutive source drifts", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: "Initial Edition" });
    const alias = await fixtures.BottleAlias({
      name: "Repeated Source Drift Alias",
      bottleId: bottle.id,
      embedding: EMBEDDING,
    });
    let revision = 0;
    createEmbedding.mockImplementation(async () => {
      revision += 1;
      await db
        .update(bottles)
        .set({ edition: `Revision ${revision}` })
        .where(eq(bottles.id, bottle.id));
      return EMBEDDING;
    });

    await expect(indexBottleAlias({ name: alias.name })).rejects.toThrow(
      `Bottle alias search source changed repeatedly while indexing: ${alias.name}`,
    );

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ embedding: null });
  });

  test("leaves an active alias unindexed when embedding generation fails", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      name: "Embedding Failure Alias",
      bottleId: bottle.id,
      ignored: false,
      embedding: EMBEDDING,
    });
    createEmbedding.mockRejectedValue(
      new Error("Embedding provider unavailable"),
    );

    await expect(indexBottleAlias({ name: alias.name })).rejects.toThrow(
      "Embedding provider unavailable",
    );

    expect(createEmbedding).toHaveBeenCalledOnce();
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      ignored: false,
      embedding: null,
    });
  });

  test("clears the embedding when the Bottle becomes inactive during generation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      name: "Concurrently Retired Alias",
      bottleId: bottle.id,
      embedding: EMBEDDING,
    });
    createEmbedding.mockImplementationOnce(async () => {
      await db.insert(bottleTombstones).values({
        bottleId: bottle.id,
        newBottleId: replacement.id,
      });
      return EMBEDDING;
    });

    await indexBottleAlias({ name: alias.name });

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ embedding: null });
  });

  test("clears the embedding when the alias becomes ignored during generation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      name: "Concurrently Ignored Alias",
      bottleId: bottle.id,
      embedding: EMBEDDING,
    });
    createEmbedding.mockImplementationOnce(async () => {
      await db
        .update(bottleAliases)
        .set({ ignored: true })
        .where(eq(bottleAliases.name, alias.name));
      return EMBEDDING;
    });

    await indexBottleAlias({ name: alias.name });

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ ignored: true, embedding: null });
  });

  test("rejects an unknown alias name", async () => {
    await expect(
      indexBottleAlias({ name: "Unknown Alias Name" }),
    ).rejects.toThrow("Unknown bottle alias: Unknown Alias Name");
    expect(createEmbedding).not.toHaveBeenCalled();
  });
});
