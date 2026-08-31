import { db } from "@peated/server/db";
import {
  bottleReferences,
  bottleTombstones,
  bottles,
  entities,
} from "@peated/server/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import type { JobPayload } from "../types";
import {
  indexBottleReference as indexBottleReferenceWithServices,
  type IndexBottleReferenceServices,
} from "./indexBottleReference";

let createEmbedding: ReturnType<
  typeof vi.fn<IndexBottleReferenceServices["createEmbedding"]>
>;

function indexBottleReference(input: JobPayload) {
  return indexBottleReferenceWithServices(input, { createEmbedding });
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
  const reference = await db.query.bottleReferences.findFirst({
    where: eq(bottleReferences.name, name),
    columns: { embedding: true },
  });
  if (!reference) throw new Error("Bottle reference fixture not found.");
  return firstEmbeddingValue(reference.embedding);
}

describe("indexBottleReference", () => {
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
      maturation: "Oloroso hogshead",
      caskStrength: true,
      singleCask: true,
      vintageYear: 1998,
      releaseYear: 2018,
      abv: 57.4,
    });
    const reference = await fixtures.BottleReference({
      name: "Authoritative Reference Aurora",
      bottleId: bottle.id,
      ignored: false,
      embedding: EMBEDDING,
    });
    createEmbedding.mockImplementation(async () => {
      expect(await getFirstStoredEmbeddingValue(reference.name)).toBeNull();
      return FRESH_EMBEDDING;
    });

    await indexBottleReference({ name: reference.name.toUpperCase() });

    expect(createEmbedding).toHaveBeenCalledOnce();
    expect(createEmbedding).toHaveBeenCalledWith(
      "Direct Bottle Brand Authoritative Reference Aurora Single Malt Solstice 19-year-old Oloroso hogshead cask strength barrel strength barrel proof full proof natural strength single cask single barrel 1998 vintage 2018 release 57.4% ABV",
    );
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, reference.name),
      }),
    ).toMatchObject({ embedding: expect.anything() });
  });

  test("clears ignored, unbound, and inactive reference embeddings", async ({
    fixtures,
  }) => {
    const ignoredBottle = await fixtures.Bottle();
    const ignoredAlias = await fixtures.BottleReference({
      name: "Ignored Reference",
      bottleId: ignoredBottle.id,
      ignored: true,
      embedding: EMBEDDING,
    });
    const unboundAlias = await fixtures.BottleReference({
      name: "Unbound Reference",
      bottleId: null,
      embedding: EMBEDDING,
    });
    const unassignedBottle = await fixtures.LegacyBottle();
    const unassignedAlias = await fixtures.BottleReference({
      name: "Unassigned Bottle Reference",
      bottleId: unassignedBottle.id,
      embedding: EMBEDDING,
    });
    const retiredBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const retiredAlias = await fixtures.BottleReference({
      name: "Retired Bottle Reference",
      bottleId: retiredBottle.id,
      embedding: EMBEDDING,
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });
    const aliases = [ignoredAlias, unboundAlias, unassignedAlias, retiredAlias];

    for (const reference of aliases) {
      await indexBottleReference({ name: reference.name });
    }

    expect(createEmbedding).not.toHaveBeenCalled();
    expect(
      await db
        .select({
          name: bottleReferences.name,
          embedding: bottleReferences.embedding,
        })
        .from(bottleReferences)
        .where(
          inArray(
            bottleReferences.name,
            aliases.map(({ name }) => name),
          ),
        )
        .orderBy(asc(bottleReferences.name)),
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
    const reference = await fixtures.BottleReference({
      name: "Concurrently Reassigned Reference",
      bottleId: originalBottle.id,
      embedding: EMBEDDING,
    });
    createEmbedding
      .mockImplementationOnce(async () => {
        await db
          .update(bottleReferences)
          .set({ bottleId: reassignedBottle.id, embedding: null })
          .where(eq(bottleReferences.name, reference.name));
        return EMBEDDING;
      })
      .mockResolvedValue(FRESH_EMBEDDING);

    await indexBottleReference({ name: reference.name });

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, reference.name),
      }),
    ).toMatchObject({ bottleId: reassignedBottle.id });
    expect(await getFirstStoredEmbeddingValue(reference.name)).toBe(0.5);
  });

  test("retries when Bottle search fields drift during generation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: "Original Edition" });
    const reference = await fixtures.BottleReference({
      name: "Bottle Source Drift Reference",
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

    await indexBottleReference({ name: reference.name });

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(createEmbedding).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Original Edition"),
    );
    expect(createEmbedding).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("Revised Edition"),
    );
    expect(await getFirstStoredEmbeddingValue(reference.name)).toBe(0.5);
  });

  test("retries when brand search fields drift during generation", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Original Search Brand",
      shortName: "OSB",
    });
    const bottle = await fixtures.Bottle({ brandId: brand.id });
    const reference = await fixtures.BottleReference({
      name: "Brand Source Drift Reference",
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

    await indexBottleReference({ name: reference.name });

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(createEmbedding).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("Original Search Brand"),
    );
    expect(createEmbedding).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("Revised Search Brand"),
    );
    expect(await getFirstStoredEmbeddingValue(reference.name)).toBe(0.5);
  });

  test("does not let an older job overwrite a newer source embedding", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: "Earlier Edition" });
    const reference = await fixtures.BottleReference({
      name: "Out Of Order Source Reference",
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

    const olderJob = indexBottleReference({ name: reference.name });
    await firstStarted;
    await db
      .update(bottles)
      .set({ edition: "Newer Edition" })
      .where(eq(bottles.id, bottle.id));
    await indexBottleReference({ name: reference.name });
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
    expect(await getFirstStoredEmbeddingValue(reference.name)).toBe(0.5);
  });

  test("fails closed after two consecutive source drifts", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ edition: "Initial Edition" });
    const reference = await fixtures.BottleReference({
      name: "Repeated Source Drift Reference",
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

    await expect(
      indexBottleReference({ name: reference.name }),
    ).rejects.toThrow(
      `Bottle reference search source changed repeatedly while indexing: ${reference.name}`,
    );

    expect(createEmbedding).toHaveBeenCalledTimes(2);
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, reference.name),
      }),
    ).toMatchObject({ embedding: null });
  });

  test("leaves an active reference unindexed when embedding generation fails", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      name: "Embedding Failure Reference",
      bottleId: bottle.id,
      ignored: false,
      embedding: EMBEDDING,
    });
    createEmbedding.mockRejectedValue(
      new Error("Embedding provider unavailable"),
    );

    await expect(
      indexBottleReference({ name: reference.name }),
    ).rejects.toThrow("Embedding provider unavailable");

    expect(createEmbedding).toHaveBeenCalledOnce();
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, reference.name),
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
    const reference = await fixtures.BottleReference({
      name: "Concurrently Retired Reference",
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

    await indexBottleReference({ name: reference.name });

    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, reference.name),
      }),
    ).toMatchObject({ embedding: null });
  });

  test("clears the embedding when the reference becomes ignored during generation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      name: "Concurrently Ignored Reference",
      bottleId: bottle.id,
      embedding: EMBEDDING,
    });
    createEmbedding.mockImplementationOnce(async () => {
      await db
        .update(bottleReferences)
        .set({ ignored: true })
        .where(eq(bottleReferences.name, reference.name));
      return EMBEDDING;
    });

    await indexBottleReference({ name: reference.name });

    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, reference.name),
      }),
    ).toMatchObject({ ignored: true, embedding: null });
  });

  test("rejects an unknown reference name", async () => {
    await expect(
      indexBottleReference({ name: "Unknown Reference Name" }),
    ).rejects.toThrow("Unknown bottle reference: Unknown Reference Name");
    expect(createEmbedding).not.toHaveBeenCalled();
  });
});
