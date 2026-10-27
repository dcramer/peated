import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("root sitemap", () => {
  it("publishes catalog sitemaps without Tastings", async () => {
    const response = await GET();
    const xml = await response.text();

    expect(xml).toContain("/sitemaps/bottles/sitemap.xml");
    expect(xml).toContain("/sitemaps/series/sitemap.xml");
    expect(xml).toContain("/sitemaps/locations.xml");
    expect(xml).toContain("/sitemaps/brands/sitemap.xml");
    expect(xml).not.toContain("/sitemaps/tastings/");
  });
});
