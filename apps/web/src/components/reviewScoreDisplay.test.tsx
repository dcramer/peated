import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import ReviewScoreDisplay from "./reviewScoreDisplay";

describe("ReviewScoreDisplay", () => {
  test("shows a whole-number score, band, and count", () => {
    const html = renderToStaticMarkup(
      <ReviewScoreDisplay score={92} count={20} />,
    );

    expect(html).toContain("92 points");
    expect(html).toContain("Outstanding");
    expect(html).toContain("20 scores");
  });
});
