import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { Entity } from "./entityPageData";
import { EntitySeriesOverview } from "./entitySeriesOverview";

const distillery = {
  ...mockEntity,
  id: 321,
  images: [],
  kind: "distillery",
  name: "Port Ellen",
  peatedId: "E0321",
} satisfies Entity;

describe("EntitySeriesOverview", () => {
  test("shows the Series with the most bottles and a full-list link", () => {
    const html = renderToStaticMarkup(
      <EntitySeriesOverview
        entity={distillery}
        error={false}
        pending={false}
        retry={() => undefined}
        seriesList={{
          rel: { nextCursor: null, prevCursor: null },
          results: [
            {
              brand: {
                id: 10,
                kind: "brand",
                name: "Rare Malts",
                peatedId: "E0010",
                shortName: null,
              },
              createdAt: "2026-01-01T00:00:00.000Z",
              description: null,
              fullName: "Rare Malts Rare Series",
              id: 20,
              imageUrl: null,
              name: "Rare Series",
              numBottles: 3,
              numReleases: 4,
              peatedId: "S0020",
              representativeBottleId: null,
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          total: 6,
        }}
      />,
    );

    expect(html).toContain("Rare Series");
    expect(html).toContain("Rare Malts");
    expect(html).toContain("3 bottles");
    expect(html).toContain("View all 6 series");
    expect(html).toContain('href="/distillers/321-port-ellen/series"');
  });

  test("omits an empty Series preview", () => {
    const html = renderToStaticMarkup(
      <EntitySeriesOverview
        entity={distillery}
        error={false}
        pending={false}
        retry={() => undefined}
        seriesList={{
          rel: { nextCursor: null, prevCursor: null },
          results: [],
          total: 0,
        }}
      />,
    );

    expect(html).toBe("");
  });
});
