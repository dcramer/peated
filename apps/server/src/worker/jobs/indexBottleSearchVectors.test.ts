import { db } from "@peated/server/db";
import { bottleAliases, bottles } from "@peated/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import indexBottleSearchVectors from "./indexBottleSearchVectors";

async function searchVectorMatches(bottleId: number, query: string) {
  const [result] = await db
    .select({
      matches: sql<boolean>`COALESCE(
        ${bottles.searchVector} @@ websearch_to_tsquery('english', ${query}),
        FALSE
      )`,
    })
    .from(bottles)
    .where(eq(bottles.id, bottleId));

  if (!result) throw new Error(`Bottle fixture not found: ${bottleId}`);
  return result.matches;
}

describe("indexBottleSearchVectors", () => {
  test("indexes durable Bottle identity and directly owned accepted aliases", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Search Index Brand",
      shortName: "SIB",
    });
    const bottler = await fixtures.Entity({ name: "Independent Bottler" });
    const distiller = await fixtures.Entity({ name: "Vector Distillery" });
    const series = await fixtures.BottleSeries({
      brandId: brand.id,
      name: "Searchable Series Zenith",
    });
    const bottle = await fixtures.Bottle({
      name: "Core Expression",
      brandId: brand.id,
      bottlerId: bottler.id,
      distillerIds: [distiller.id],
      seriesId: series.id,
      edition: "Promoted Batch Solstice",
      statedAge: 19,
      abv: 57.4,
      vintageYear: 1998,
      releaseYear: 2018,
      singleCask: true,
      caskStrength: true,
      caskType: "oloroso",
    });
    const unrelatedBottle = await fixtures.Bottle({
      name: "Unrelated Expression",
    });
    await fixtures.BottleAlias({
      name: "Authoritative Alias Aurora",
      bottleId: bottle.id,
      ignored: false,
    });
    await fixtures.BottleAlias({
      name: "Direct Alias Quasar",
      bottleId: bottle.id,
      ignored: false,
    });
    await fixtures.BottleAlias({
      name: "Ignored Exact Nebula",
      bottleId: bottle.id,
      ignored: true,
    });
    await fixtures.BottleAlias({
      name: "Foreign Direct Pulsar",
      bottleId: unrelatedBottle.id,
      ignored: false,
    });

    await db
      .update(bottles)
      .set({ searchVector: null })
      .where(eq(bottles.id, bottle.id));
    await indexBottleSearchVectors({ bottleId: bottle.id });

    expect(
      await searchVectorMatches(bottle.id, "Promoted Batch Solstice"),
    ).toBe(true);
    expect(await searchVectorMatches(bottle.id, "1998 vintage")).toBe(true);
    expect(await searchVectorMatches(bottle.id, "Independent Bottler")).toBe(
      true,
    );
    expect(await searchVectorMatches(bottle.id, "Vector Distillery")).toBe(
      true,
    );
    expect(
      await searchVectorMatches(bottle.id, "Searchable Series Zenith"),
    ).toBe(true);
    expect(
      await searchVectorMatches(bottle.id, "Authoritative Alias Aurora"),
    ).toBe(true);
    expect(await searchVectorMatches(bottle.id, "Direct Alias Quasar")).toBe(
      true,
    );
    expect(await searchVectorMatches(bottle.id, "Ignored Exact Nebula")).toBe(
      false,
    );
    expect(await searchVectorMatches(bottle.id, "Foreign Direct Pulsar")).toBe(
      false,
    );
    expect(
      await db
        .select({ name: bottleAliases.name })
        .from(bottleAliases)
        .where(eq(bottleAliases.bottleId, bottle.id)),
    ).toEqual(
      expect.arrayContaining([
        { name: "Authoritative Alias Aurora" },
        { name: "Direct Alias Quasar" },
        { name: "Ignored Exact Nebula" },
      ]),
    );
  });

  test("rejects an unknown Bottle", async () => {
    await expect(
      indexBottleSearchVectors({ bottleId: 2_147_483_647 }),
    ).rejects.toThrow("Unknown bottle: 2147483647");
  });
});
