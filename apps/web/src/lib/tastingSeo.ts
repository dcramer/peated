import { getRatingBandById } from "@peated/server/constants";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import type { Metadata } from "next";

import { getBottleUrl, getTastingUrl } from "./urls";

type Tasting = Outputs["tastings"]["details"];
type TastingSeoSource = Pick<
  Tasting,
  "id" | "notes" | "imageUrl" | "createdAt" | "ratingBand"
> & {
  bottle: Parameters<typeof getBottleUrl>[0] & { imageUrl: string | null };
  createdBy: Pick<Tasting["createdBy"], "username" | "private">;
};

export function getTastingSeoMetadata(tasting: TastingSeoSource): Metadata {
  if (tasting.createdBy.private) {
    return {
      title: "Private tasting",
      robots: { index: false, follow: false },
    };
  }

  const bottleName = formatBottleDisplayName(tasting.bottle);
  const title = `${bottleName} — tasting by ${tasting.createdBy.username}`;
  const rating = tasting.ratingBand
    ? ` Rated ${getRatingBandById(tasting.ratingBand).label}.`
    : "";
  const notes = tasting.notes?.replace(/\s+/g, " ").trim();
  const summary =
    notes ||
    `Whisky tasting of ${bottleName} by ${tasting.createdBy.username}.${rating}`;
  const description =
    summary.length > 160 ? `${summary.slice(0, 157).trimEnd()}...` : summary;
  const url = getTastingUrl(tasting);
  const authorUrl = `/users/${encodeURIComponent(tasting.createdBy.username)}`;
  const imageUrl = tasting.imageUrl || tasting.bottle.imageUrl;
  const images = imageUrl
    ? [
        {
          url: imageUrl,
          alt: tasting.imageUrl ? title : `${bottleName} bottle`,
        },
      ]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    authors: [{ name: tasting.createdBy.username, url: authorUrl }],
    openGraph: {
      type: "article",
      locale: "en_US",
      siteName: "Peated",
      title,
      description,
      url,
      publishedTime: tasting.createdAt,
      authors: [new URL(authorUrl, config.URL_PREFIX).href],
      images,
    },
    twitter: {
      card: tasting.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}

/** Tasting SEO owns attribution: private activity must never enter structured data. */
export function serializeTastingStructuredData(
  tasting: TastingSeoSource,
): string | null {
  if (tasting.createdBy.private) return null;

  const bottleName = formatBottleDisplayName(tasting.bottle);
  const url = new URL(getTastingUrl(tasting), config.URL_PREFIX).href;
  const bottleUrl = new URL(getBottleUrl(tasting.bottle), config.URL_PREFIX)
    .href;
  const title = `${bottleName} — tasting by ${tasting.createdBy.username}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Review",
    "@id": `${url}#review`,
    url,
    name: title,
    mainEntityOfPage: url,
    datePublished: tasting.createdAt,
    author: {
      "@type": "Person",
      name: tasting.createdBy.username,
      url: new URL(
        `/users/${encodeURIComponent(tasting.createdBy.username)}`,
        config.URL_PREFIX,
      ).href,
    },
    reviewBody: tasting.notes?.trim() || undefined,
    image: tasting.imageUrl || undefined,
    // Ratings owns the score: a named tasting rating must not become a numeric reviewRating.
    itemReviewed: {
      "@type": "Product",
      "@id": `${bottleUrl}#product`,
      name: bottleName,
      image: tasting.bottle.imageUrl || undefined,
      url: bottleUrl,
      brand: {
        "@type": "Brand",
        name: tasting.bottle.brand.name,
      },
    },
  };

  // Tasting SEO embeds member text in a script element; escape HTML delimiters.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
