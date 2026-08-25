import type { CollectionBottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BottleTable from "./bottleTable";

function makeCollectionBottle(): CollectionBottle {
  const timestamp = "2026-08-23T00:00:00.000Z";
  const brand = {
    id: 2,
    peatedId: "E000002",
    name: "Compass Box",
    shortName: null,
    type: ["brand" as const],
    description: null,
    descriptionSrc: null,
    yearEstablished: null,
    website: null,
    country: null,
    region: null,
    address: null,
    location: null,
    totalTastings: 0,
    totalBottles: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    id: 1,
    imageUrl: null,
    status: null,
    bottle: {
      id: 42,
      peatedId: "B000042",
      fullName: "Compass Box No Name No. 1",
      name: "No Name No. 1",
      brand,
      group: {
        schemaVersion: 1,
        id: 7,
        fullName: "Compass Box No Name",
        name: "No Name",
        brandId: brand.id,
        bottlerId: null,
        distillerIds: [],
        category: "blend",
        seriesId: null,
        statedAge: null,
        representativeBottleId: 42,
        flavorProfile: null,
        avgRating: null,
        ratingStats: {
          pass: 0,
          sip: 0,
          savor: 0,
          total: 0,
          avg: null,
          percentage: { pass: 0, sip: 0, savor: 0 },
        },
        totalTastings: 0,
        totalBottles: 1,
        createdByActorId: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
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
      distillers: [],
      bottler: null,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      flavorProfile: null,
      tastingNotes: null,
      suggestedTags: [],
      avgRating: null,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
        percentage: { pass: 0, sip: 0, savor: 0 },
      },
      totalTastings: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      isFavorite: false,
      isLibrary: true,
      hasTasted: true,
    },
    hasTasted: true,
  };
}

describe("BottleTable", () => {
  it("renders bottle status immediately after the bold bottle name", () => {
    const html = renderToStaticMarkup(
      <BottleTable
        bottleList={[makeCollectionBottle()]}
        compactIdentity
        hideLibraryStatus
        noHeaders
        searchParams={new URLSearchParams()}
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
    const brand = {
      ...collectionBottle.bottle.brand,
      id: 3,
      peatedId: "E000003",
      name: "Woodford Reserve",
    };
    const bottle = {
      ...collectionBottle.bottle,
      fullName: "Woodford Reserve Batch Proof",
      name: "Batch Proof",
      brand,
      group: {
        ...collectionBottle.bottle.group!,
        fullName: "Woodford Reserve Batch Proof",
        name: "Batch Proof",
        brandId: brand.id,
      },
      series: {
        id: 4,
        name: "Master's Collection",
        brand,
        fullName: "Woodford Reserve Master's Collection",
        description: null,
        numReleases: 1,
        createdAt: collectionBottle.bottle.createdAt,
        updatedAt: collectionBottle.bottle.updatedAt,
      },
      edition: null,
    };
    const html = renderToStaticMarkup(
      <BottleTable
        bottleList={[bottle]}
        groupBy={(item) => item.brand}
        groupItem={(item) => item.name}
        groupTo={(group) => `/entities/${group.id}`}
        noHeaders
        searchParams={new URLSearchParams()}
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
