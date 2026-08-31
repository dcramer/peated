import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TastingEntry } from "./tastingEntry.stylex";

function renderDescription(description: string, descriptionHref?: string) {
  return renderToStaticMarkup(
    <TastingEntry
      author="peatfan"
      date="Today"
      members={[
        {
          description,
          descriptionHref,
          name: "Lagavulin 16-year-old",
        },
      ]}
    />,
  );
}

describe("TastingEntry descriptions", () => {
  it("shows short tasting notes without a details link", () => {
    const html = renderDescription(
      "Smoke, fruit, and sea salt.",
      "/tastings/1",
    );

    expect(html).toContain("Smoke, fruit, and sea salt.");
    expect(html).not.toContain("Read more");
  });

  it("shortens long tasting notes and links to the tasting details", () => {
    const html = renderDescription(
      `${"Smoke, fruit, and sea salt. ".repeat(12)}The final sentence.`,
      "/tastings/42",
    );

    expect(html).toContain("Read more");
    expect(html).toContain('href="/tastings/42"');
    expect(html).toContain(
      'aria-label="Read the full tasting notes for Lagavulin 16-year-old"',
    );
    expect(html).not.toContain("The final sentence.");
  });

  it("shows the full tasting notes when no details link is provided", () => {
    const description = `${"Smoke, fruit, and sea salt. ".repeat(12)}The final sentence.`;
    const html = renderDescription(description);

    expect(html).toContain("The final sentence.");
    expect(html).not.toContain("Read more");
  });
});
