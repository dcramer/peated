import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleTombstones,
  entityTombstones,
} from "@peated/server/db/schema";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /search", () => {
  test("returns independently capped groups with exact totals", async ({
    fixtures,
  }) => {
    const bottles = await Promise.all(
      ["One", "Two", "Three", "Four"].map((suffix) =>
        fixtures.Bottle({ name: `Contractneedle Bottle ${suffix}` }),
      ),
    );
    const distiller = await fixtures.Entity({
      name: "Contractneedle Distiller",
      kind: "distillery",
    });
    const brand = await fixtures.Entity({
      name: "Contractneedle Brand",
      kind: "brand",
    });
    const bottler = await fixtures.Entity({
      name: "Contractneedle Bottler",
      kind: "bottler",
    });
    const blender = await fixtures.Entity({
      name: "Contractneedle Blender",
      kind: "blender",
    });
    const company = await fixtures.Entity({
      name: "Contractneedle Company",
      kind: "company",
    });
    const region = await fixtures.Region({
      name: "Contractneedle Region",
      totalBottles: 8,
    });

    const data = await routerClient.search({
      query: "contractneedle",
      scopes: [
        "regions",
        "companies",
        "brands",
        "bottles",
        "blenders",
        "bottlers",
        "distilleries",
      ],
      limit: 2,
    });

    expect(data.groups.map(({ type }) => type)).toEqual([
      "bottles",
      "distilleries",
      "brands",
      "bottlers",
      "blenders",
      "companies",
      "regions",
    ]);
    expect(data.groups).toMatchObject([
      {
        type: "bottles",
        total: 4,
        results: [{ id: bottles[0]!.id }, { id: bottles[1]!.id }],
      },
      { type: "distilleries", total: 1, results: [{ id: distiller.id }] },
      { type: "brands", total: 1, results: [{ id: brand.id }] },
      { type: "bottlers", total: 1, results: [{ id: bottler.id }] },
      { type: "blenders", total: 1, results: [{ id: blender.id }] },
      { type: "companies", total: 1, results: [{ id: company.id }] },
      { type: "regions", total: 1, results: [{ id: region.id }] },
    ]);
  });

  test("applies entity scopes before their result limits", async ({
    fixtures,
  }) => {
    await Promise.all(
      ["One", "Two", "Three"].map((suffix) =>
        fixtures.Entity({
          name: `Scopedneedle Brand ${suffix}`,
          kind: "brand",
        }),
      ),
    );
    const distiller = await fixtures.Entity({
      name: "Scopedneedle Distiller",
      kind: "distillery",
    });

    const data = await routerClient.search({
      query: "scopedneedle",
      scopes: ["distilleries"],
      limit: 1,
    });

    expect(data.groups).toMatchObject([
      { type: "distilleries", total: 1, results: [{ id: distiller.id }] },
    ]);
  });

  test("uses kind as the authority for every Entity search scope", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Kindauthority Brand",
      kind: "brand",
    });
    const company = await fixtures.Entity({
      name: "Kindauthority Company",
      kind: "company",
    });

    const data = await routerClient.search({
      query: "kindauthority",
      scopes: ["brands", "companies"],
    });

    expect(data.groups).toMatchObject([
      { type: "brands", results: [{ id: brand.id }] },
      { type: "companies", results: [{ id: company.id }] },
    ]);
  });

  test("returns searchable scope totals", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Population Bottle" });
    await fixtures.Entity({
      name: "Population Bottler",
      kind: "bottler",
    });
    await fixtures.Entity({
      name: "Population Blender",
      kind: "blender",
    });
    await fixtures.Entity({
      name: "Population Company",
      kind: "company",
    });

    const data = await routerClient.search({
      query: "no-population-match",
      scopes: ["bottles", "bottlers", "blenders", "companies"],
    });

    expect(data.scopeTotals.bottles).toBeGreaterThanOrEqual(1);
    expect(data.scopeTotals.bottlers).toBeGreaterThanOrEqual(1);
    expect(data.scopeTotals.blenders).toBeGreaterThanOrEqual(1);
    expect(data.scopeTotals.companies).toBeGreaterThanOrEqual(1);
    expect(data.scopeTotals.members).toBeUndefined();
  });

  test("keeps member search authenticated and hides unsearchable profiles", async ({
    defaults,
    fixtures,
  }) => {
    const publicMember = await fixtures.User({
      username: "memberneedle-public",
    });
    const privateMember = await fixtures.User({
      username: "memberneedle-private",
      private: true,
    });
    await fixtures.Tasting({ createdById: publicMember.id });
    await fixtures.Tasting({ createdById: publicMember.id });
    await fixtures.Tasting({ createdById: privateMember.id });

    const [anonymous, authenticated] = await Promise.all([
      routerClient.search({ query: "memberneedle", scopes: ["members"] }),
      routerClient.search(
        { query: "memberneedle", scopes: ["members"] },
        { context: { user: defaults.user } },
      ),
    ]);

    expect(anonymous.groups).toEqual([]);
    expect(anonymous.scopeTotals.members).toBeUndefined();
    expect(authenticated.groups).toMatchObject([
      {
        type: "members",
        total: 1,
        results: [{ member: { id: publicMember.id }, totalTastings: 2 }],
      },
    ]);
  });

  test("includes followed private members without exposing their tasting count", async ({
    defaults,
    fixtures,
  }) => {
    const privateMember = await fixtures.User({
      username: "followedneedle-private",
      private: true,
    });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: privateMember.id,
      status: "following",
    });
    await fixtures.Tasting({ createdById: privateMember.id });

    const data = await routerClient.search(
      { query: "followedneedle", scopes: ["members"] },
      { context: { user: defaults.user } },
    );

    expect(data.groups).toMatchObject([
      {
        type: "members",
        total: 1,
        results: [{ member: { id: privateMember.id }, totalTastings: 0 }],
      },
    ]);
  });

  test("ranks exact, name-prefix, and any-word-prefix matches in order", async ({
    fixtures,
  }) => {
    const word = await fixtures.Bottle({ name: "House Rankneedle" });
    const prefix = await fixtures.Bottle({ name: "Rankneedle Extra" });
    const exact = await fixtures.Bottle({ name: "Rankneedle" });

    const data = await routerClient.search({
      query: "rankneedle",
      scopes: ["bottles"],
      limit: 10,
    });
    const group = data.groups[0];

    expect(group?.type).toBe("bottles");
    if (group?.type !== "bottles") throw new Error("Expected Bottles group");
    expect(group.results.map(({ id }) => id)).toEqual([
      exact.id,
      prefix.id,
      word.id,
    ]);
  });

  test("uses community rating count only to break equal text matches", async ({
    fixtures,
  }) => {
    const lessRated = await fixtures.Bottle({
      name: "Tienneedle Alpha",
      memberScoreCount: 1,
    });
    const moreRated = await fixtures.Bottle({
      name: "Tienneedle Beta",
      memberScoreCount: 5,
    });

    const data = await routerClient.search({
      query: "tienneedle",
      scopes: ["bottles"],
      limit: 10,
    });
    const group = data.groups[0];

    if (group?.type !== "bottles") throw new Error("Expected Bottles group");
    expect(group.results.map(({ id }) => id)).toEqual([
      moreRated.id,
      lessRated.id,
    ]);
  });

  test("returns server-ranked nearest matches for a settled miss", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Laphroaig" });

    const data = await routerClient.search({
      query: "Laphroaigg",
      scopes: ["bottles"],
    });

    expect(data.groups).toMatchObject([
      { type: "bottles", total: 0, results: [] },
    ]);
    expect(data.nearest).toMatchObject([
      { type: "bottles", result: { id: bottle.id } },
    ]);
  });

  test("resolves Bottle and Entity Peated ID tombstones directly", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const entity = await fixtures.Entity({ kind: "company" });
    await db.insert(bottleTombstones).values({
      bottleId: 9001,
      newBottleId: bottle.id,
    });
    await db.insert(entityTombstones).values({
      entityId: 9002,
      newEntityId: entity.id,
    });

    const [bottleData, entityData] = await Promise.all([
      routerClient.search({
        query: formatPeatedId("bottle", 9001),
        scopes: ["bottles"],
      }),
      routerClient.search({
        query: formatPeatedId("entity", 9002),
        scopes: ["companies"],
      }),
    ]);

    expect(bottleData.groups).toEqual([]);
    expect(bottleData.exact).toMatchObject({
      type: "bottle",
      ref: { id: bottle.id, peatedId: formatPeatedId("bottle", bottle.id) },
    });
    expect(entityData.exact).toMatchObject({
      type: "entity",
      ref: { id: entity.id, peatedId: formatPeatedId("entity", entity.id) },
    });
  });

  test("searches active Bottles and directly assigned aliases", async ({
    fixtures,
  }) => {
    const retainedBottle = await fixtures.Bottle({ name: "Retained Pair" });
    await fixtures.LegacyBottle({ name: "Legacy Search Orphan" });
    await db.insert(bottleAliases).values({
      bottleId: retainedBottle.id,
      name: "Authoritative Search Alias",
      assignedByActorId: retainedBottle.createdByActorId,
    });

    const [aliasSearch, legacySearch] = await Promise.all([
      routerClient.search({
        query: "Authoritative Search Alias",
        scopes: ["bottles"],
      }),
      routerClient.search({
        query: "Legacy Search Orphan",
        scopes: ["bottles"],
      }),
    ]);

    expect(aliasSearch.groups).toMatchObject([
      { type: "bottles", total: 1, results: [{ id: retainedBottle.id }] },
    ]);
    expect(legacySearch.groups).toMatchObject([
      { type: "bottles", total: 0, results: [] },
    ]);
  });

  test("rejects unknown scopes", async () => {
    const error = await waitError(() =>
      routerClient.search({
        query: "test",
        // SAFETY: This test sends an invalid scope to the runtime validator.
        scopes: ["unknown" as any],
      }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});
