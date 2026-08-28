import type { CollectionBottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BottleTable from "./bottleTable";

function makeCollectionBottle(): CollectionBottle {
  const timestamp = "2026-08-23T00:00:00.000Z";
  const brand = {
    id: 2,
    peatedId: "E0002",
    name: "Compass Box",
    shortName: null,
    kind: "brand" as const,
    ownerId: null,
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
      peatedId: "B0042",
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
        medianScore: null,
        minScore: null,
        maxScore: null,
        memberScoreCount: 0,
        externalScoreCount: 0,
        scoreCount: 0,
        tastingBandCounts: {
          mediocre: 0,
          good: 0,
          very_good: 0,
          outstanding: 0,
          unicorn: 0,
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
      bottlingYear: null,
      releaseYear: null,
      releaseDate: null,
      singleCask: false,
      caskStrength: false,
      naturalColor: null,
      nonChillFiltered: null,
      maltPhenolPpm: null,
      noAgeStatement: true,
      outturn: null,
      maturation: null,
      caskNumber: null,
      distillers: [],
      bottler: null,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      flavorProfile: null,
      tastingNotes: null,
      suggestedTags: [],
      medianScore: null,
      minScore: null,
      maxScore: null,
      memberScoreCount: 0,
      externalScoreCount: 0,
      scoreCount: 0,
      tastingBandCounts: {
        mediocre: 0,
        good: 0,
        very_good: 0,
        outstanding: 0,
        unicorn: 0,
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
    expect(html).toContain("No age statement");
  });

  it("labels NAS bottles in the Age column", () => {
    const html = renderToStaticMarkup(
      <BottleTable
        bottleList={[makeCollectionBottle()]}
        noHeaders
        searchParams={new URLSearchParams()}
      />,
    );

    expect(html).toContain('aria-label="No age statement"');
    expect(html).toContain(">NAS</span>");
    expect(html).toContain('class="sm:hidden"');
    expect(html).toContain('class="hidden sm:block"');
  });

  it("leaves an unknown age unlabeled", () => {
    const collectionBottle = makeCollectionBottle();
    collectionBottle.bottle.noAgeStatement = null;
    const html = renderToStaticMarkup(
      <BottleTable
        bottleList={[collectionBottle]}
        noHeaders
        searchParams={new URLSearchParams()}
      />,
    );

    expect(html).not.toContain("No age statement");
    expect(html).not.toContain(">NAS</span>");
  });

  it("groups by the Bottle while retaining its nonduplicative Series", () => {
    const collectionBottle = makeCollectionBottle();
    const brand = {
      ...collectionBottle.bottle.brand,
      id: 3,
      peatedId: "E0003",
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
