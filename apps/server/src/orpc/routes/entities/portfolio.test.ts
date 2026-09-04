import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /entities/{company}/portfolio", () => {
  test("lists direct and nested whisky Entities with exact totals and paths", async ({
    fixtures,
  }) => {
    const company = await fixtures.Entity({
      kind: "company",
      name: "Parent Company",
    });
    const group = await fixtures.Entity({
      kind: "company",
      name: "Portfolio Company",
      ownerId: company.id,
    });
    const directBrand = await fixtures.Entity({
      kind: "brand",
      name: "Direct Brand",
      ownerId: company.id,
      totalBottles: 4,
    });
    const nestedDistillery = await fixtures.Entity({
      kind: "distillery",
      name: "Nested Distillery",
      ownerId: group.id,
      totalBottles: 8,
    });
    const nestedBottler = await fixtures.Entity({
      kind: "bottler",
      name: "Nested Bottler",
      ownerId: nestedDistillery.id,
      totalBottles: 2,
    });

    const result = await routerClient.entities.portfolio({
      company: company.id,
      sort: "-bottles",
    });

    expect(result.total).toBe(3);
    expect(result.totals).toEqual({
      all: 3,
      brands: 1,
      distilleries: 1,
      bottlers: 1,
    });
    expect(result.results.map(({ id }) => id)).toEqual([
      nestedDistillery.id,
      directBrand.id,
      nestedBottler.id,
    ]);
    expect(
      result.results.find(({ id }) => id === nestedBottler.id)?.ownershipPath,
    ).toEqual([
      expect.objectContaining({ id: company.id, kind: "company" }),
      expect.objectContaining({ id: group.id, kind: "company" }),
      expect.objectContaining({
        id: nestedDistillery.id,
        kind: "distillery",
      }),
    ]);
    expect(result.groupCompanies).toEqual({
      results: [
        expect.objectContaining({
          id: group.id,
          kind: "company",
        }),
      ],
      total: 1,
    });
  });

  test("filters by kind and keeps totals for the complete portfolio", async ({
    fixtures,
  }) => {
    const company = await fixtures.Entity({ kind: "company" });
    const brand = await fixtures.Entity({
      kind: "brand",
      ownerId: company.id,
    });
    await fixtures.Entity({ kind: "distillery", ownerId: company.id });

    const result = await routerClient.entities.portfolio({
      company: company.id,
      kinds: ["brand"],
    });

    expect(result.results.map(({ id }) => id)).toEqual([brand.id]);
    expect(result.total).toBe(1);
    expect(result.totals.all).toBe(2);
  });

  test("paginates in stable Entity ID order when sort values match", async ({
    fixtures,
  }) => {
    const company = await fixtures.Entity({ kind: "company" });
    const first = await fixtures.Entity({
      kind: "brand",
      ownerId: company.id,
      totalBottles: 5,
    });
    const second = await fixtures.Entity({
      kind: "brand",
      ownerId: company.id,
      totalBottles: 5,
    });

    const pageOne = await routerClient.entities.portfolio({
      company: company.id,
      kinds: ["brand"],
      limit: 1,
    });
    const pageTwo = await routerClient.entities.portfolio({
      company: company.id,
      kinds: ["brand"],
      cursor: 2,
      limit: 1,
    });

    expect(pageOne.results[0]?.id).toBe(first.id);
    expect(pageOne.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(pageTwo.results[0]?.id).toBe(second.id);
    expect(pageTwo.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });

  test("returns an empty portfolio without inventing relationships", async ({
    fixtures,
  }) => {
    const company = await fixtures.Entity({ kind: "company" });

    const result = await routerClient.entities.portfolio({
      company: company.id,
    });

    expect(result.results).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totals.all).toBe(0);
    expect(result.groupCompanies).toEqual({ results: [], total: 0 });
  });

  test("stops if corrupt ownership data loops back to the Company", async ({
    fixtures,
  }) => {
    const company = await fixtures.Entity({ kind: "company" });
    const brand = await fixtures.Entity({
      kind: "brand",
      ownerId: company.id,
    });
    await db
      .update(entities)
      .set({ ownerId: brand.id })
      .where(eq(entities.id, company.id));

    const result = await routerClient.entities.portfolio({
      company: company.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([brand.id]);
  });

  test("rejects a non-Company root", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ kind: "brand" });

    await expect(
      routerClient.entities.portfolio({ company: brand.id }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Choose a Company.",
    });
  });

  test("bounds a larger portfolio response while retaining exact totals", async ({
    fixtures,
  }) => {
    const company = await fixtures.Entity({
      countryId: null,
      kind: "company",
      name: "Large Portfolio Company",
    });

    const groups: (typeof company)[] = [];
    for (let groupIndex = 0; groupIndex < 5; groupIndex += 1) {
      const group = await fixtures.Entity({
        countryId: null,
        createdByActorId: company.createdByActorId,
        kind: "company",
        name: `Portfolio Group ${groupIndex}`,
        ownerId: company.id,
      });
      groups.push(group);
    }

    await db.insert(entities).values(
      groups.flatMap((group, groupIndex) =>
        Array.from({ length: 12 }, (_, brandIndex) => ({
          kind: "brand" as const,
          name: `Portfolio Brand ${groupIndex}-${brandIndex}`,
          ownerId: group.id,
          totalBottles: brandIndex,
          createdByActorId: company.createdByActorId,
        })),
      ),
    );

    const result = await routerClient.entities.portfolio({
      company: company.id,
      kinds: ["brand"],
      limit: 25,
    });

    expect(result.results).toHaveLength(25);
    expect(result.total).toBe(60);
    expect(result.totals).toMatchObject({ all: 60, brands: 60 });
    expect(result.rel.nextCursor).toBe(2);
    expect(JSON.stringify(result).length).toBeLessThan(100_000);
  });
});
