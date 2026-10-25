import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getLocationMapUrl, getRegionMap } from "./locationMap";

const publicDir = path.resolve(import.meta.dirname, "../../public");

function listMapSlugs(folder: string) {
  return readdirSync(path.join(publicDir, "assets/maps", folder))
    .filter((file) => file.endsWith(".svg"))
    .map((file) => file.slice(0, -".svg".length));
}

function publicFileExists(url: string) {
  return existsSync(path.join(publicDir, decodeURIComponent(url)));
}

describe("getRegionMap", () => {
  it("selects Islay's own map", () => {
    expect(getRegionMap("scotland", "islay")).toEqual({
      kind: "region",
      slug: "scotland/islay",
    });
  });

  it("selects US state maps", () => {
    expect(getRegionMap("united-states", "kentucky")).toEqual({
      kind: "state",
      slug: "kentucky",
    });
  });

  it("omits unavailable maps instead of using the parent country", () => {
    expect(getRegionMap("scotland", "unknown")).toBeNull();
    expect(getRegionMap("ireland", "islay")).toBeNull();
    expect(getRegionMap("ireland", "highland")).toBeNull();
  });

  it.each(["highland", "speyside", "lowland", "campbeltown", "islands"])(
    "selects the Scottish %s map",
    (region) => {
      expect(getRegionMap("scotland", region)).toEqual({
        kind: "region",
        slug: `scotland/${region}`,
      });
    },
  );

  it("uses the Campbeltown map for the legacy catalog spelling", () => {
    expect(getRegionMap("scotland", "cambeltown")).toEqual(
      getRegionMap("scotland", "campbeltown"),
    );
  });
});

describe("getLocationMapUrl", () => {
  it.each([
    ["country", "countries"],
    ["state", "us-states"],
  ] as const)("finds artwork for every %s map file", (kind, folder) => {
    for (const slug of listMapSlugs(folder)) {
      const url = getLocationMapUrl({ kind, slug });
      expect(url, slug).not.toBeNull();
      expect(publicFileExists(url!), slug).toBe(true);
    }
  });

  it("finds artwork for every Scottish region map", () => {
    for (const region of [
      "islay",
      "highland",
      "speyside",
      "lowland",
      "campbeltown",
      "islands",
    ]) {
      const url = getLocationMapUrl(getRegionMap("scotland", region)!);
      expect(publicFileExists(url!), region).toBe(true);
    }
  });

  it("encodes slugs with non-ASCII letters", () => {
    expect(getLocationMapUrl({ kind: "country", slug: "türkiye" })).toBe(
      "/assets/maps/countries/t%C3%BCrkiye.svg",
    );
  });

  it("returns null when there is no artwork", () => {
    expect(getLocationMapUrl({ kind: "country", slug: "atlantis" })).toBeNull();
    expect(getLocationMapUrl({ kind: "state", slug: "ontario" })).toBeNull();
  });
});
