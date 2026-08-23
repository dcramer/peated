import { describe, expect, test } from "vitest";
import { parseGeometryPoint } from "./geometry";

describe("parseGeometryPoint", () => {
  test("parses hexadecimal point geometry", () => {
    expect(
      parseGeometryPoint("0101000020E6100000CDCCCCCCCC0C4C409A999999999909C0"),
    ).toEqual([56.1, -3.2]);
  });

  test("parses point geometry from relational JSON", () => {
    expect(
      parseGeometryPoint({
        type: "Point",
        coordinates: [56.1, -3.2],
        crs: {
          type: "name",
          properties: { name: "EPSG:4326" },
        },
      }),
    ).toEqual([56.1, -3.2]);
  });

  test.each([
    "not-geometry",
    "010200000002000000000000000000F03F000000000000004000000000000008400000000000001040",
    { type: "LineString", coordinates: [56.1, -3.2] },
    { type: "Point", coordinates: [56.1] },
    { coordinates: { lat: 56.1, lng: -3.2 } },
  ])("rejects malformed geometry %#", (value) => {
    expect(() => parseGeometryPoint(value)).toThrow();
  });
});
