import { describe, expect, it } from "vitest";
import {
  parseScrapeSourceKind,
  SCRAPE_SOURCE_KIND_OPTIONS,
} from "./scrapeSourceKinds";

describe("scrape source kinds", () => {
  it("offers official product catalogs", () => {
    expect(SCRAPE_SOURCE_KIND_OPTIONS).toContainEqual({
      label: "Official product catalog",
      value: "catalog",
    });
    expect(parseScrapeSourceKind("catalog")).toBe("catalog");
  });

  it("rejects unknown kinds", () => {
    expect(() => parseScrapeSourceKind("unknown")).toThrow(
      "Unsupported content type.",
    );
  });
});
