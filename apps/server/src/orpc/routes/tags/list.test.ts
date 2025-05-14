import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /tags", () => {
  test("lists tags", async ({ fixtures }) => {
    await fixtures.Tag({ name: "a" });
    await fixtures.Tag({ name: "b" });

    const { results } = await routerClient.tags.list();

    expect(results.length).toBe(2);
    expect(results[0].name).toEqual("a");
    expect(results[1].name).toEqual("b");
  });
});
