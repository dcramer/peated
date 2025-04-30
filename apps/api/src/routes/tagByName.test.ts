import waitError from "@peated/server/lib/test/waitError";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCaller } from "../trpc/router";

describe("tagByName", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("retrieves a tag by name", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ name: "TestTag" });
    const caller = createCaller({ user: null });

    const result = await caller.tagByName("TestTag");

    expect(result).toBeDefined();
    expect(result.name).toBe("TestTag");
  });

  test("throws NOT_FOUND for non-existent tag", async ({ fixtures }) => {
    const caller = createCaller({ user: null });

    const err = await waitError(caller.tagByName("NonExistentTag"));

    expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
  });

  test("is case-sensitive", async ({ fixtures }) => {
    await fixtures.Tag({ name: "TestTag" });
    const caller = createCaller({ user: null });

    const err = await waitError(caller.tagByName("testtag"));

    expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
  });

  test("returns serialized tag data", async ({ fixtures }) => {
    const tag = await fixtures.Tag({
      name: "TestTag",
      tagCategory: "fruity",
      flavorProfiles: ["young_spritely"],
    });
    const caller = createCaller({ user: null });

    const result = await caller.tagByName("TestTag");

    expect(result.name).toBe("TestTag");
    expect(result.tagCategory).toBe("fruity");
    expect(result.flavorProfiles).toEqual(["young_spritely"]);
  });

  test("works with authenticated user", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ name: "TestTag" });
    const user = await fixtures.User();
    const caller = createCaller({ user });

    const result = await caller.tagByName("TestTag");

    expect(result).toBeDefined();
  });

  test("handles special characters in tag names", async ({ fixtures }) => {
    const tagName = "Test & Special Characters!";
    await fixtures.Tag({ name: tagName });
    const caller = createCaller({ user: null });

    const result = await caller.tagByName(tagName);

    expect(result).toBeDefined();
    expect(result.name).toBe(tagName);
  });
});
