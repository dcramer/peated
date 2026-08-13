import type { Bottle, CollectionBottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BottleTable from "./bottleTable";

vi.mock("next/navigation", () => ({
  usePathname: () => "/entities/3/bottles",
  useSearchParams: () => new URLSearchParams(),
}));

function makeCollectionBottle(): CollectionBottle {
  return {
    id: 1,
    bottle: {
      id: 42,
      fullName: "Compass Box No Name No. 1",
      name: "No Name No. 1",
      brand: { id: 2, name: "Compass Box", shortName: null },
      group: { name: "No Name", statedAge: null },
      series: null,
      edition: "No. 1",
      category: "blend",
      statedAge: null,
      abv: 48.9,
      vintageYear: null,
      releaseYear: null,
      singleCask: false,
      caskStrength: false,
      caskFill: null,
      caskType: null,
      caskSize: null,
      avgRating: null,
      ratingStats: { total: 0 },
    },
    hasTasted: true,
  } as CollectionBottle;
}

describe("BottleTable", () => {
  it("renders bottle status immediately after the bold bottle name", () => {
    const html = renderToStaticMarkup(
      <BottleTable
        bottleList={[makeCollectionBottle()]}
        compactIdentity
        hideLibraryStatus
        noHeaders
        showBottleStats={false}
      />,
    );

    const namePosition = html.indexOf("No Name</a>");
    const statusPosition = html.indexOf('aria-label="Tasted"');
    const metadataPosition = html.indexOf("48.9% ABV");

    expect(namePosition).toBeGreaterThan(-1);
    expect(statusPosition).toBeGreaterThan(namePosition);
    expect(metadataPosition).toBeGreaterThan(statusPosition);
  });

  it("groups by the Bottle while retaining its nonduplicative Series", () => {
    const collectionBottle = makeCollectionBottle();
    const bottle = {
      ...collectionBottle.bottle,
      fullName: "Woodford Reserve Batch Proof",
      name: "Batch Proof",
      brand: { id: 3, name: "Woodford Reserve", shortName: null },
      group: { name: "Batch Proof", statedAge: null },
      series: { id: 4, name: "Master's Collection" },
      edition: null,
    } as Bottle;
    const html = renderToStaticMarkup(
      <BottleTable
        bottleList={[bottle]}
        groupBy={(item) => item.brand}
        groupItem={(item) => item.name}
        groupTo={(group) => `/entities/${group.id}`}
        showBottleStats={false}
      />,
    );

    const visibleText = html.replace(/<[^>]*>/g, "");
    expect(visibleText.match(/Woodford Reserve/g)).toHaveLength(1);
    expect(html).toContain('href="/entities/3"');
    expect(html).toContain("Master&#x27;s Collection");
    expect(html).toContain('href="/bottles?series=4"');
    expect(html).toContain("Batch Proof");
  });
});
