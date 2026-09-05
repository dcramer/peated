import { mockBottle } from "@peated/server/orpc/mock/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TastingReviewBottleSummary } from "./tastingReviewBottleSummary.stylex";

describe("TastingReviewBottleSummary", () => {
  it("prefers the tasting or review photo over the catalog image", () => {
    const html = renderToStaticMarkup(
      <TastingReviewBottleSummary
        bottle={{ ...mockBottle, imageUrl: "/catalog.webp" }}
        photoUrl="/tasting.webp"
        placement="desktop"
      />,
    );

    expect(html).toContain('src="/tasting.webp"');
    expect(html.indexOf('src="/tasting.webp"')).toBeLessThan(
      html.indexOf('src="/catalog.webp"'),
    );
  });

  it("uses the catalog image when the tasting or review has no photo", () => {
    const html = renderToStaticMarkup(
      <TastingReviewBottleSummary
        bottle={{ ...mockBottle, imageUrl: "/catalog.webp" }}
        photoUrl={null}
        placement="desktop"
      />,
    );

    expect(html.match(/src="\/catalog\.webp"/g)).toHaveLength(2);
  });

  it("does not show a large image when neither image exists", () => {
    const html = renderToStaticMarkup(
      <TastingReviewBottleSummary
        bottle={mockBottle}
        photoUrl={null}
        placement="mobile"
      />,
    );

    expect(html).not.toContain("at full size");
    expect(html).toContain("Lagavulin 16-year-old");
  });
});
