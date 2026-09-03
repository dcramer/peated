import { describe, expect, it } from "vitest";
import {
  getBottleRouteRedirect,
  getLocationRouteRedirect,
  getSeriesRouteRedirect,
  matchBottleRoute,
  matchLocationRoute,
  matchSeriesRoute,
} from "./catalogPageRoutes";

describe("catalog page redirects", () => {
  it("redirects old bottle identities and preserves nested pages", () => {
    const bottle = {
      id: 43,
      name: "16-year-old",
      brand: { name: "Lagavulin" },
    };
    for (const path of ["/bottles/42", "/bottles/42-old.name", "/B0042"]) {
      expect(getBottleRouteRedirect(matchBottleRoute(path)!, bottle)).toBe(
        "/bottles/43-lagavulin-16-year-old",
      );
    }
    expect(
      getBottleRouteRedirect(
        matchBottleRoute("/bottles/42-old/tastings")!,
        bottle,
      ),
    ).toBe("/bottles/43-lagavulin-16-year-old/tastings");
    expect(matchBottleRoute("/bottles/0")).toBeNull();
    for (const suffix of [
      "aliases",
      "tastings",
      "similar",
      "prices",
      "releases",
      "edit",
      "audit",
      "merge",
      "addTasting",
      "addRelease",
    ]) {
      expect(matchBottleRoute(`/bottles/42-old/${suffix}`)?.suffix).toBe(
        `/${suffix}`,
      );
    }
    for (const suffix of [
      "bottlings",
      "bottlings/new",
      "bottlings/9303",
      "bottlings/9303/edit",
      "releases/9303/edit",
    ]) {
      expect(matchBottleRoute(`/bottles/42/${suffix}`)).toBeNull();
    }
  });
  it("redirects numeric, stale, and Peated series IDs to the current identity", () => {
    for (const path of ["/series/42", "/series/42-old.name", "/S0042"]) {
      expect(
        getSeriesRouteRedirect(matchSeriesRoute(path)!, {
          id: 43,
          fullName: "Ardbeg Supernova",
        }),
      ).toBe("/series/43-ardbeg-supernova");
    }
    expect(
      getSeriesRouteRedirect(matchSeriesRoute("/series/42-old/edit")!, {
        id: 42,
        fullName: "Ardbeg Supernova",
      }),
    ).toBe("/series/42-ardbeg-supernova/edit");
  });
  it("leaves canonical Unicode series URLs alone", () => {
    const path = "/series/42-山崎";
    for (const pathname of [path, encodeURI(path)]) {
      expect(
        getSeriesRouteRedirect(matchSeriesRoute(pathname)!, {
          id: 42,
          fullName: "山崎",
        }),
      ).toBeNull();
    }
  });
  it.each([
    "/series",
    "/series/0",
    "/series/1.5",
    "/series/1e2",
    "/series/9007199254740992",
    "/B0042",
  ])("does not resolve %s as a series", (path) => {
    expect(matchSeriesRoute(path)).toBeNull();
  });
  it("canonicalizes country and region paths while retaining tabs", () => {
    const country = matchLocationRoute("/locations/SCOTLAND/regions")!;
    expect(country).toMatchObject({
      countrySlug: "SCOTLAND",
      regionSlug: null,
      suffix: "/regions",
    });
    expect(getLocationRouteRedirect(country, { slug: "scotland" })).toBe(
      "/locations/scotland/regions",
    );
    const region = matchLocationRoute(
      "/locations/SCOTLAND/regions/ISLAY/bottles",
    )!;
    expect(region).toMatchObject({
      countrySlug: "SCOTLAND",
      regionSlug: "ISLAY",
      suffix: "/bottles",
    });
    expect(
      getLocationRouteRedirect(region, {
        slug: "islay",
        country: { slug: "scotland" },
      }),
    ).toBe("/locations/scotland/regions/islay/bottles");
    expect(
      getLocationRouteRedirect(matchLocationRoute("/locations/scotland")!, {
        slug: "scotland",
      }),
    ).toBeNull();
  });
  it("decodes location slugs without changing the browse routes", () => {
    expect(
      matchLocationRoute("/locations/c%C3%B4te-d-ivoire")?.countrySlug,
    ).toBe("côte-d-ivoire");
    for (const path of [
      "/locations",
      "/locations/all-regions",
      "/locations/%ZZ",
    ]) {
      expect(matchLocationRoute(path)).toBeNull();
    }
  });
});
