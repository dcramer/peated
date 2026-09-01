import { describe, expect, it } from "vitest";

import { getEntityBottleCreateHref } from "./entityBottleCreateHref";

describe("getEntityBottleCreateHref", () => {
  it("returns to the canonical public Entity route", () => {
    const href = getEntityBottleCreateHref({
      id: 4263,
      kind: "bottler",
      name: "Scotch Malt Whisky Society",
    });
    const url = new URL(href!, "https://peated.com");

    expect(url.pathname).toBe("/bottles/new");
    expect(url.searchParams.get("bottler")).toBe("4263");
    expect(url.searchParams.get("returnTo")).toBe(
      "/bottlers/4263-scotch-malt-whisky-society",
    );
  });

  it("does not offer bottle creation for a company", () => {
    expect(
      getEntityBottleCreateHref({ id: 1, kind: "company", name: "Diageo" }),
    ).toBe(undefined);
  });
});
