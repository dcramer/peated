import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import config from "@peated/web/config";
import type { Metadata } from "next";

import { serializeJsonLd } from "./structuredData";
import { getBottleUrl, getMemberReviewUrl } from "./urls";

type MemberReview = Outputs["memberReviews"]["details"];
type MemberReviewSeoSource = Pick<
  MemberReview,
  "id" | "score" | "notes" | "imageUrl" | "createdAt" | "updatedAt"
> & {
  bottle: Parameters<typeof getBottleUrl>[0] & {
    brand: { name: string };
    imageUrl: string | null;
  };
  createdBy: Pick<MemberReview["createdBy"], "username" | "private">;
};

export function getMemberReviewSeoMetadata(
  review: MemberReviewSeoSource,
): Metadata {
  if (review.createdBy.private) {
    return {
      title: "Private review",
      robots: { index: false, follow: false },
    };
  }

  const bottleName = formatBottleDisplayName(review.bottle);
  const title = `${bottleName} — review by ${review.createdBy.username}`;
  const notes = review.notes?.replace(/\s+/g, " ").trim();
  const summary =
    notes ||
    `${review.createdBy.username} scored ${bottleName} ${review.score} out of 100.`;
  const description =
    summary.length > 160 ? `${summary.slice(0, 157).trimEnd()}...` : summary;
  const url = getMemberReviewUrl(review);
  const authorUrl = `/users/${encodeURIComponent(review.createdBy.username)}`;
  const imageUrl = review.imageUrl || review.bottle.imageUrl;
  const images = imageUrl
    ? [
        {
          url: imageUrl,
          alt: review.imageUrl ? title : `${bottleName} bottle`,
        },
      ]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: url },
    authors: [{ name: review.createdBy.username, url: authorUrl }],
    openGraph: {
      type: "article",
      locale: "en_US",
      siteName: "Peated",
      title,
      description,
      url,
      publishedTime: review.createdAt,
      modifiedTime: review.updatedAt,
      authors: [new URL(authorUrl, config.URL_PREFIX).href],
      images,
    },
    twitter: {
      card: review.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}

/** Review SEO owns attribution: private activity must never enter structured data. */
export function serializeMemberReviewStructuredData(
  review: MemberReviewSeoSource,
): string | null {
  if (review.createdBy.private) return null;

  const bottleName = formatBottleDisplayName(review.bottle);
  const reviewUrl = new URL(getMemberReviewUrl(review), config.URL_PREFIX).href;
  const bottleUrl = new URL(getBottleUrl(review.bottle), config.URL_PREFIX)
    .href;
  const title = `${bottleName} — review by ${review.createdBy.username}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Review",
    "@id": `${reviewUrl}#review`,
    name: title,
    url: reviewUrl,
    mainEntityOfPage: reviewUrl,
    datePublished: review.createdAt,
    dateModified: review.updatedAt,
    author: {
      "@type": "Person",
      name: review.createdBy.username,
      url: new URL(
        `/users/${encodeURIComponent(review.createdBy.username)}`,
        config.URL_PREFIX,
      ).href,
    },
    reviewBody: review.notes?.trim() || undefined,
    image: review.imageUrl || undefined,
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.score,
      bestRating: 100,
      worstRating: 0,
    },
    itemReviewed: {
      "@type": "Product",
      "@id": `${bottleUrl}#product`,
      name: bottleName,
      image: review.bottle.imageUrl || undefined,
      url: bottleUrl,
      brand: {
        "@type": "Brand",
        name: review.bottle.brand.name,
      },
    },
  };

  return serializeJsonLd(data);
}
