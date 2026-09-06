import { mockMemberReview } from "@peated/server/orpc/mock/fixtures";
import config from "@peated/web/config";
import { describe, expect, it } from "vitest";

import {
  getMemberReviewSeoMetadata,
  serializeMemberReviewStructuredData,
} from "./reviewSeo";

describe("member review SEO", () => {
  it("publishes canonical article metadata for a public review", () => {
    const metadata = getMemberReviewSeoMetadata(mockMemberReview);

    expect(metadata).toMatchObject({
      title: expect.stringContaining("review by"),
      description: expect.stringContaining("Freshly poured"),
      alternates: { canonical: `/reviews/${mockMemberReview.id}` },
      authors: [
        {
          name: mockMemberReview.createdBy.username,
          url: `/users/${mockMemberReview.createdBy.username}`,
        },
      ],
      openGraph: {
        type: "article",
        publishedTime: mockMemberReview.createdAt,
        modifiedTime: mockMemberReview.updatedAt,
      },
      twitter: { card: "summary_large_image" },
    });
    expect(metadata.description?.length).toBeLessThanOrEqual(160);
  });

  it("marks up the reviewed Product and exact member score", () => {
    const data = JSON.parse(
      serializeMemberReviewStructuredData(mockMemberReview)!,
    );

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Review",
      url: `${config.URL_PREFIX}/reviews/${mockMemberReview.id}`,
      datePublished: mockMemberReview.createdAt,
      dateModified: mockMemberReview.updatedAt,
      author: {
        "@type": "Person",
        name: mockMemberReview.createdBy.username,
      },
      reviewBody: mockMemberReview.notes,
      reviewRating: {
        "@type": "Rating",
        ratingValue: mockMemberReview.score,
        bestRating: 100,
        worstRating: 0,
      },
      itemReviewed: {
        "@type": "Product",
        name: expect.any(String),
        url: expect.stringContaining("/bottles/"),
        brand: {
          "@type": "Brand",
          name: mockMemberReview.bottle.brand.name,
        },
      },
    });
  });

  it("escapes member text and excludes private reviews", () => {
    const unsafe = {
      ...mockMemberReview,
      notes: '</script><script>alert("review")</script>',
      createdBy: {
        ...mockMemberReview.createdBy,
        username: '</script><script>alert("author")</script>',
      },
    };
    const json = serializeMemberReviewStructuredData(unsafe)!;
    expect(json).not.toContain("<");
    expect(JSON.parse(json).reviewBody).toBe(unsafe.notes);

    const privateReview = {
      ...mockMemberReview,
      createdBy: { ...mockMemberReview.createdBy, private: true },
    };
    expect(getMemberReviewSeoMetadata(privateReview)).toEqual({
      title: "Private review",
      robots: { index: false, follow: false },
    });
    expect(serializeMemberReviewStructuredData(privateReview)).toBeNull();
  });
});
