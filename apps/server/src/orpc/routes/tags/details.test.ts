import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("GET /tags/:tag", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("retrieves a tag by name", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ name: "TestTag" });
    const result = await routerClient.tags.details({ tag: "TestTag" });

    expect(result).toBeDefined();
    expect(result.name).toBe("TestTag");
  });

  test("throws NOT_FOUND for non-existent tag", async ({ fixtures }) => {
    const err = await waitError(
      routerClient.tags.details({ tag: "NonExistentTag" }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Tag not found.]`);
  });

  test("is case-sensitive", async ({ fixtures }) => {
    await fixtures.Tag({ name: "TestTag" });
    const err = await waitError(routerClient.tags.details({ tag: "testtag" }));

    expect(err).toMatchInlineSnapshot(`[Error: Tag not found.]`);
  });

  test("returns serialized tag data", async ({ fixtures }) => {
    const tag = await fixtures.Tag({
      name: "TestTag",
      tagCategory: "fruity",
      flavorProfiles: ["young_spritely"],
    });

    const result = await routerClient.tags.details({ tag: "TestTag" });

    expect(result.name).toBe("TestTag");
    expect(result.tagCategory).toBe("fruity");
    expect(result.flavorProfiles).toEqual(["young_spritely"]);
  });

  test("works with authenticated user", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ name: "TestTag" });
    const user = await fixtures.User();

    const result = await routerClient.tags.details(
      { tag: "TestTag" },
      { context: { user } },
    );

    expect(result).toBeDefined();
  });

  test("handles special characters in tag names", async ({ fixtures }) => {
    const tagName = "Test & Special Characters!";
    await fixtures.Tag({ name: tagName });

    const result = await routerClient.tags.details({ tag: tagName });

    expect(result).toBeDefined();
    expect(result.name).toBe(tagName);
  });
});
