import { describe, expect, it } from "vitest";
import { getTastingRouteRedirect, matchTastingRoute } from "./tastingRoutes";

const tasting = {
  id: 123,
  bottle: { name: "16-year-old", brand: { name: "Lagavulin" } },
};

describe("public tasting routes", () => {
  it.each(["/tastings/123", "/tastings/123-old.name"])(
    "redirects %s with its nested route",
    (path) => {
      expect(
        getTastingRouteRedirect(matchTastingRoute(`${path}/edit`)!, tasting),
      ).toBe("/tastings/123-lagavulin-16-year-old/edit");
    },
  );

  it("does not redirect current slugs, including encoded Unicode", () => {
    expect(
      getTastingRouteRedirect(
        matchTastingRoute("/tastings/123-lagavulin-16-year-old")!,
        tasting,
      ),
    ).toBeNull();
    const japaneseTasting = {
      id: 123,
      bottle: { name: "東京", brand: { name: "" } },
    };
    expect(
      getTastingRouteRedirect(
        matchTastingRoute("/tastings/123-%E6%9D%B1%E4%BA%AC")!,
        japaneseTasting,
      ),
    ).toBeNull();
  });

  it.each([
    "/tastings",
    "/tastings/0",
    "/tastings/123-",
    "/tastings/9007199254740992",
    "/bottles/123",
  ])("does not claim %s", (path) => {
    expect(matchTastingRoute(path)).toBeNull();
  });
});
