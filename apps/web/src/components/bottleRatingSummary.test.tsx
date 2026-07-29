import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BottleRatingSummary from "./bottleRatingSummary";

describe("BottleRatingSummary", () => {
  it("pairs the average visualization with the rated sample count", () => {
    const html = renderToStaticMarkup(
      <BottleRatingSummary avgRating={1.5} totalRatings={31} />,
    );

    expect(html).toContain("Average rating 1.50");
    expect(html).toContain("31 ratings");
    expect(html).toContain("self-center");
    expect(html).toContain("items-center");
    expect(html).toContain("text-center");
  });

  it("shows a stable empty state without an average", () => {
    const html = renderToStaticMarkup(
      <BottleRatingSummary avgRating={null} totalRatings={0} />,
    );

    expect(html).toContain("0 ratings");
    expect(html).not.toContain("Average rating");
  });
});
