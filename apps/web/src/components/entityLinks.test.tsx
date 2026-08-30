import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EntityLinks } from "./entityLinks";

describe("EntityLinks", () => {
  it("links every entity in display order", () => {
    const html = renderToStaticMarkup(
      <EntityLinks
        entities={[
          { id: 129, kind: "distillery", name: "Glen Moray" },
          { id: 366, kind: "distillery", name: "Caol Ila" },
          { id: 142, kind: "distillery", name: "Glen Spey" },
        ]}
      />,
    );

    expect(html).toContain('href="/distillers/129"');
    expect(html).toContain('href="/distillers/366"');
    expect(html).toContain('href="/distillers/142"');
    expect(html).toContain("Glen Moray");
    expect(html).toContain("Caol Ila");
    expect(html).toContain("Glen Spey");
    expect(html.indexOf("Glen Moray")).toBeLessThan(html.indexOf("Caol Ila"));
    expect(html.indexOf("Caol Ila")).toBeLessThan(html.indexOf("Glen Spey"));
  });

  it("uses the entity fallback route when the kind is unknown", () => {
    const html = renderToStaticMarkup(
      <EntityLinks entities={[{ id: 5, kind: null, name: "Unknown" }]} />,
    );

    expect(html).toContain('href="/entities/5"');
  });
});
