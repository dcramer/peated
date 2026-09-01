import { describe, expect, it } from "vitest";

import {
  getBottleSeoMetadata,
  getEntitySeoMetadata,
  getSeriesSeoMetadata,
  homeMetadata,
} from "./seoMetadata";

describe("SEO metadata", () => {
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
