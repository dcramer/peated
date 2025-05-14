import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /", () => {
  test("returns version info", async () => {
    const result = await routerClient.root();
    expect(result.version).toBeDefined();
  });
});
