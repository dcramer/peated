import { TRPCError } from "@trpc/server";
import { createCaller } from "../router";

describe("search", () => {
  test("searches across bottles and entities without authentication", async ({
    fixtures,
    expect,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Unique Whiskey" });
    const entity = await fixtures.Entity({ name: "Unique Distillery" });
    const user = await fixtures.User({ username: "uniqueuser" });

    const caller = createCaller({ user: null });
    const { results } = await caller.search({
      query: "unique",
      limit: 10,
    });

    expect(results.length).toBe(2);
    expect(
      results.some((r) => r.type === "bottle" && r.ref.id === bottle.id),
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "entity" && r.ref.id === entity.id),
    ).toBeTruthy();
  });

  test("searches across bottles, entities, and users with authentication", async ({
    fixtures,
    defaults,
    expect,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Unique Whiskey" });
    const entity = await fixtures.Entity({ name: "Unique Distillery" });
    const user = await fixtures.User({ username: "uniqueuser" });

    const caller = createCaller({ user: defaults.user });
    const { results } = await caller.search({
      query: "unique",
      limit: 10,
    });

    expect(results.length).toBe(3);
    expect(
      results.some((r) => r.type === "bottle" && r.ref.id === bottle.id),
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "entity" && r.ref.id === entity.id),
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "user" && r.ref.id === user.id),
    ).toBeTruthy();
  });

  test("limits search to specified types", async ({ fixtures, expect }) => {
    await fixtures.Bottle({ name: "Unique Whiskey" });
    const entity = await fixtures.Entity({ name: "Unique Distillery" });

    const caller = createCaller({ user: null });
    const { results } = await caller.search({
      query: "unique",
      include: ["entities"],
      limit: 10,
    });

    expect(results.length).toBe(1);
    expect(results[0].type).toBe("entity");
    expect(results[0].ref.id).toBe(entity.id);
  });

  test("respects the limit parameter", async ({ fixtures, expect }) => {
    await fixtures.Bottle({ name: "Unique Whiskey 1" });
    await fixtures.Bottle({ name: "Unique Whiskey 2" });
    await fixtures.Bottle({ name: "Unique Whiskey 3" });

    const caller = createCaller({ user: null });
    const { results } = await caller.search({
      query: "unique",
      limit: 2,
    });

    expect(results.length).toBe(2);
  });

  test("sorts exact matches first", async ({ fixtures, expect }) => {
    await fixtures.Bottle({ name: "Lagavulin 16" });
    const exactMatch = await fixtures.Bottle({ name: "Lagavulin" });

    const caller = createCaller({ user: null });
    const { results } = await caller.search({
      query: "Lagavulin",
      limit: 10,
    });

    expect(results[0].type).toBe("bottle");
    expect(results[0].ref.id).toBe(exactMatch.id);
  });

  test("handles empty query", async ({ fixtures, expect }) => {
    const caller = createCaller({ user: null });
    const { results } = await caller.search({
      query: "",
      limit: 10,
    });

    expect(results.length).toBe(0);
  });

  test("handles query with no results", async ({ fixtures, expect }) => {
    const caller = createCaller({ user: null });
    const { results } = await caller.search({
      query: "nonexistentitem",
      limit: 10,
    });

    expect(results.length).toBe(0);
  });

  test("throws error for invalid include parameter", async ({
    fixtures,
    expect,
  }) => {
    const caller = createCaller({ user: null });
    await expect(
      caller.search({
        query: "test",
        include: ["invalidtype" as any],
        limit: 10,
      }),
    ).rejects.toThrow(TRPCError);
  });
});
