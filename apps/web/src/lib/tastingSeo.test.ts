import config from "@peated/web/config";
import { describe, expect, it } from "vitest";

import {
  getTastingSeoMetadata,
  serializeTastingStructuredData,
} from "./tastingSeo";

const tasting = {
  id: 123,
  notes: "Smoke and honey.\n\nA long finish.",
  imageUrl: "https://images.peated.com/tasting.jpg",
  createdAt: "2026-09-01T12:00:00.000Z",
  ratingBand: "very_good" as const,
  createdBy: { username: "alice", private: false },
  bottle: {
    id: 42,
    name: "16-year-old",
    brand: { name: "Lagavulin" },
    imageUrl: "https://images.peated.com/bottle.jpg",
  },
};

describe("tasting SEO", () => {
  it("uses the tasting URL and consistent search and social descriptions", () => {
    const metadata = getTastingSeoMetadata(tasting);
    const title = "Lagavulin 16-year-old — tasting by alice";
    const description = "Smoke and honey. A long finish.";

    expect(metadata).toMatchObject({
      title,
      description,
      alternates: { canonical: "/tastings/123-lagavulin-16-year-old" },
      authors: [{ name: "alice", url: "/users/alice" }],
      openGraph: {
        type: "article",
        title,
        description,
        url: "/tastings/123-lagavulin-16-year-old",
        publishedTime: tasting.createdAt,
        images: [{ url: tasting.imageUrl, alt: title }],
      },
      twitter: { title, description, card: "summary_large_image" },
    });
  });

  it("keeps long notes out of search snippets without truncating structured content", () => {
    const notes = "Smoke and honey. ".repeat(40).trim();
    const metadata = getTastingSeoMetadata({ ...tasting, notes });
    expect(metadata.description?.length).toBeLessThanOrEqual(160);
    expect(metadata.description).toMatch(/\.\.\.$/);
    const data = JSON.parse(
      serializeTastingStructuredData({ ...tasting, notes })!,
    );
    expect(data.mainEntity.text).toBe(notes);
  });

  it.each([null, "", " \n\t "])(
    "describes a tasting without notes (%s)",
    (notes) => {
      const metadata = getTastingSeoMetadata({
        ...tasting,
        notes,
        imageUrl: null,
      });
      expect(metadata).toMatchObject({
        description:
          "Whisky tasting of Lagavulin 16-year-old by alice. Rated Very good.",
        openGraph: {
          images: [
            {
              url: tasting.bottle.imageUrl,
              alt: "Lagavulin 16-year-old bottle",
            },
          ],
        },
        twitter: { card: "summary" },
      });
    },
  );

  it("supports tastings without a rating or any image", () => {
    const metadata = getTastingSeoMetadata({
      ...tasting,
      notes: null,
      imageUrl: null,
      ratingBand: null,
      bottle: { ...tasting.bottle, imageUrl: null },
    });
    expect(metadata.description).toBe(
      "Whisky tasting of Lagavulin 16-year-old by alice.",
    );
    expect(metadata.openGraph).toHaveProperty("images", undefined);
    expect(metadata.twitter).toMatchObject({ card: "summary" });
  });

  it("attributes the tasting and identifies the bottle without inventing a review score", () => {
    const data = JSON.parse(serializeTastingStructuredData(tasting)!);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: `${config.URL_PREFIX}/tastings/123-lagavulin-16-year-old`,
      mainEntity: {
        "@type": "CreativeWork",
        datePublished: tasting.createdAt,
        author: {
          "@type": "Person",
          name: "alice",
          url: `${config.URL_PREFIX}/users/alice`,
        },
        text: tasting.notes,
        image: tasting.imageUrl,
        about: {
          "@type": "Product",
          name: "Lagavulin 16-year-old",
          url: `${config.URL_PREFIX}/bottles/42-lagavulin-16-year-old`,
        },
      },
    });
    expect(data.mainEntity).not.toHaveProperty("reviewRating");
    expect(data.mainEntity.about).not.toHaveProperty("aggregateRating");
  });

  it("safely serializes member text containing HTML and script delimiters", () => {
    const notes = '</script><script>alert("notes")</script> & smoke';
    const username = '</script><script>alert("author")</script>';
    const json = serializeTastingStructuredData({
      ...tasting,
      notes,
      createdBy: { ...tasting.createdBy, username },
    })!;
    expect(json).not.toContain("<");
    expect(JSON.parse(json).mainEntity.text).toBe(notes);
    expect(JSON.parse(json).mainEntity.author.name).toBe(username);
  });

  it("omits private content from metadata and structured data", () => {
    const privateTasting = {
      ...tasting,
      createdBy: { ...tasting.createdBy, private: true },
    };
    expect(getTastingSeoMetadata(privateTasting)).toEqual({
      title: "Private tasting",
      robots: { index: false, follow: false },
    });
    expect(serializeTastingStructuredData(privateTasting)).toBeNull();
  });
});
