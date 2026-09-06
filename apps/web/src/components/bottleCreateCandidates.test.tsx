import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BottleCreateCandidateSummary } from "./bottleCreateCandidates.stylex";

describe("BottleCreateCandidateSummary", () => {
  test("keeps the summary in place while its matches update", () => {
    const html = renderToStaticMarkup(
      <BottleCreateCandidateSummary
        count={2}
        loading
        onReview={() => undefined}
      />,
    );

    expect(html).toContain("2 bottles may match this one.");
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("Review");
  });
});
