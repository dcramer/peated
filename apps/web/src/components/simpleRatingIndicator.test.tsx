import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SimpleRatingIndicator from "./simpleRatingIndicator";

describe("SimpleRatingIndicator", () => {
  it("renders a continuous two-thumb positive average", () => {
    const html = renderToStaticMarkup(
      <SimpleRatingIndicator avgRating={1.5} />,
    );

    expect(html).toContain('aria-label="Average rating 1.50"');
    expect(html).toContain("width:100%");
    expect(html).toContain("width:50%");
  });

  it("renders a proportional thumb down for a negative average", () => {
    const html = renderToStaticMarkup(
      <SimpleRatingIndicator avgRating={-0.25} />,
    );

    expect(html).toContain('aria-label="Average rating -0.25"');
    expect(html).toContain("width:25%");
  });

  it("renders nothing without an average", () => {
    expect(
      renderToStaticMarkup(<SimpleRatingIndicator avgRating={null} />),
    ).toBe("");
  });
});
