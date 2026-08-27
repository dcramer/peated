import { describe, expect, it } from "vitest";

import { PointSchema } from "./shared";

describe("PointSchema", () => {
  it("accepts longitude followed by latitude", () => {
    expect(PointSchema.parse([-122.4194, 37.7749])).toEqual([
      -122.4194, 37.7749,
    ]);
  });

  it("rejects a latitude-first tuple with an invalid second coordinate", () => {
    expect(() => PointSchema.parse([35.6762, 139.6503])).toThrow();
  });
});
