import {
  mockEntity,
  mockExternalReview,
  mockMemberReview,
  mockTasting,
} from "@peated/server/orpc/mock/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { Entity } from "./entityPageData";
import { EntityReviewsAndTastingsOverview } from "./entityReviewsAndTastingsOverview";

const distillery = {
  ...mockEntity,
  id: 321,
  images: [],
  kind: "distillery",
  name: "Port Ellen",
  peatedId: "E0321",
  publicReviewAndTastingCount: 18,
} satisfies Entity;

describe("EntityReviewsAndTastingsOverview", () => {
  test("shows the three newest related reviews and tastings", () => {
    const html = renderToStaticMarkup(
      <EntityReviewsAndTastingsOverview
        reviewsAndTastings={{
          rel: { nextCursor: null },
          results: [
            { type: "tasting", tasting: mockTasting },
            { type: "member_review", review: mockMemberReview },
            { type: "critic_review", review: mockExternalReview },
            {
              type: "tasting",
              tasting: {
                ...mockTasting,
                id: mockTasting.id + 100,
                createdBy: {
                  ...mockTasting.createdBy,
                  username: "hidden-fourth-member",
                },
              },
            },
          ],
        }}
        entity={distillery}
        error={false}
        pending={false}
        retry={() => undefined}
      />,
    );

    expect(html).toContain("Recent activity");
    expect(html).toContain("View all activity");
    expect(html).not.toContain("hidden-fourth-member");
    expect(html).toContain('href="/distillers/321-port-ellen/tastings"');
  });

  test("omits an empty activity preview", () => {
    const html = renderToStaticMarkup(
      <EntityReviewsAndTastingsOverview
        entity={distillery}
        error={false}
        pending={false}
        retry={() => undefined}
        reviewsAndTastings={{ rel: { nextCursor: null }, results: [] }}
      />,
    );

    expect(html).toBe("");
  });

  test("does not add the distillery preview to other entity pages", () => {
    const html = renderToStaticMarkup(
      <EntityReviewsAndTastingsOverview
        entity={{ ...distillery, kind: "brand" }}
        error={false}
        pending={true}
        retry={() => undefined}
      />,
    );

    expect(html).toBe("");
  });
});
