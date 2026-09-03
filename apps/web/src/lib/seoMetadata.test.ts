import { describe, expect, it } from "vitest";

import {
  getBottleSeoMetadata,
  getCatalogSeoMetadata,
  getCountrySeoMetadata,
  getEntitySeoMetadata,
  getRegionSeoMetadata,
  getSeriesSeoMetadata,
  homeMetadata,
} from "./seoMetadata";

describe("SEO metadata", () => {
  it("provides plain location metadata and separate canonical URLs for tabs", () => {
    const country = { name: "Scotland", slug: "scotland", description: null };
    expect(getCountrySeoMetadata(country)).toMatchObject({
      title: "Whisky from Scotland",
      description:
        "Browse whisky bottles from Scotland, with ratings and tasting notes on Peated.",
      alternates: { canonical: "/locations/scotland" },
      openGraph: { title: "Whisky from Scotland", url: "/locations/scotland" },
      twitter: { title: "Whisky from Scotland" },
    });
    expect(
      getRegionSeoMetadata(
        {
          name: "Islay",
          slug: "islay",
          description: "**Smoky** whisky.\n\nMade on Islay.",
          country,
        },
        {
          section: "distillers",
          searchParams: { cursor: "2", utm_source: "mail" },
        },
      ),
    ).toMatchObject({
      title: "Whisky distilleries in Islay, Scotland",
      alternates: {
        canonical: "/locations/scotland/regions/islay/distillers?cursor=2",
      },
      robots: undefined,
    });
    expect(
      getCountrySeoMetadata({
        ...country,
        description: "**Scotch** whisky.\n\nMade in Scotland.",
      }).description,
    ).toBe("Scotch whisky. Made in Scotland.");
  });
  it("excludes filters and personal lists from indexing without losing pagination", () => {
    const page = {
      title: "Whisky bottles",
      description: "Browse whisky bottles.",
      url: "/bottles",
    };
    expect(getCatalogSeoMetadata(page, { cursor: "2" })).toMatchObject({
      alternates: { canonical: "/bottles?cursor=2" },
      robots: undefined,
    });
    for (const searchParams of [
      { library: "in" },
      { sort: "name" },
      { query: "Islay" },
    ]) {
      expect(getCatalogSeoMetadata(page, searchParams).robots).toEqual({
        index: false,
        follow: true,
      });
    }
    expect(
      getCatalogSeoMetadata(page, { cursor: "1.5", _rsc: "abc" }).alternates,
    ).toEqual({ canonical: "/bottles" });
    expect(
      getCatalogSeoMetadata({
        ...page,
        description: "A long description. ".repeat(20),
      }).description?.length,
    ).toBeLessThanOrEqual(160);
  });
  it("defines the homepage search and social metadata", () => {
    expect(homeMetadata).toMatchObject({
      title: {
        absolute: "Peated: Whisky bottles, reviews, and tasting notes",
      },
      alternates: { canonical: "/" },
      openGraph: {
        locale: "en_US",
        siteName: "Peated",
        title: "Peated: Whisky bottles, reviews, and tasting notes",
        type: "website",
        url: "/",
      },
      twitter: {
        card: "summary",
        title: "Peated: Whisky bottles, reviews, and tasting notes",
      },
    });
  });

  it("builds canonical Bottle metadata with an image", () => {
    const metadata = getBottleSeoMetadata(
      {
        id: 42,
        name: "16-year-old",
        brand: { name: "Lagavulin" },
        description: "A smoky Islay single malt.",
        imageUrl: "https://images.peated.com/lagavulin.jpg",
      },
      { canonical: true },
    );

    expect(metadata).toMatchObject({
      title: "Lagavulin 16-year-old",
      description: "A smoky Islay single malt.",
      alternates: { canonical: "/bottles/42-lagavulin-16-year-old" },
      openGraph: {
        locale: "en_US",
        siteName: "Peated",
        title: "Lagavulin 16-year-old",
        url: "/bottles/42-lagavulin-16-year-old",
        images: [
          {
            url: "https://images.peated.com/lagavulin.jpg",
            alt: "Lagavulin 16-year-old bottle",
          },
        ],
      },
      twitter: { card: "summary" },
    });
  });

  it("uses useful Bottle metadata when optional content is missing", () => {
    const metadata = getBottleSeoMetadata({
      id: 42,
      name: "16-year-old",
      brand: { name: "Lagavulin" },
      description: null,
      imageUrl: null,
    });

    expect(metadata).toMatchObject({
      description:
        "See bottle details for Lagavulin 16-year-old in the Peated whisky database.",
      twitter: { card: "summary" },
    });
    expect(metadata.alternates).toBeUndefined();
  });

  it("adds the kind and canonical collection to Entity metadata", () => {
    const metadata = getEntitySeoMetadata(
      {
        id: 12,
        kind: "distillery",
        name: "Lagavulin",
        description: null,
        images: [
          { imageUrl: "https://images.peated.com/lagavulin-distillery.jpg" },
        ],
      },
      { canonical: true },
    );

    expect(metadata).toMatchObject({
      title: "Lagavulin — Whisky distillery",
      description:
        "See details for Lagavulin, a whisky distillery, in the Peated whisky database.",
      alternates: { canonical: "/distillers/12-lagavulin" },
      openGraph: {
        locale: "en_US",
        siteName: "Peated",
        url: "/distillers/12-lagavulin",
        images: [
          {
            url: "https://images.peated.com/lagavulin-distillery.jpg",
            alt: "Lagavulin",
          },
        ],
      },
      twitter: { card: "summary" },
    });
  });

  it("supports Entity metadata without images", () => {
    const metadata = getEntitySeoMetadata({
      id: 12,
      kind: "distillery",
      name: "Lagavulin",
      description: null,
    });

    expect(metadata).toMatchObject({
      title: "Lagavulin — Whisky distillery",
      twitter: { card: "summary" },
    });
  });

  it("builds canonical Series metadata with its bottle count", () => {
    const metadata = getSeriesSeoMetadata(
      {
        id: 421,
        fullName: "Dramfool Jim McEwan Signature Collection",
        description: null,
        numReleases: 12,
      },
      { canonical: true },
    );

    expect(metadata).toMatchObject({
      title: "Dramfool Jim McEwan Signature Collection — Whisky series",
      description:
        "See 12 bottles in the Dramfool Jim McEwan Signature Collection series.",
      alternates: {
        canonical: "/series/421-dramfool-jim-mc-ewan-signature-collection",
      },
      openGraph: {
        locale: "en_US",
        siteName: "Peated",
        url: "/series/421-dramfool-jim-mc-ewan-signature-collection",
      },
      twitter: { card: "summary" },
    });
  });
});
