import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CursorPager, ListToolbar } from "./lists.stylex";

describe("CursorPager", () => {
  it("places page context before the navigation actions", () => {
    const html = renderToStaticMarkup(
      <CursorPager
        nextHref="/activity?page=4"
        page={3}
        previousHref="/activity?page=2"
      />,
    );

    expect(html.indexOf("Page 3")).toBeLessThan(html.indexOf("← Previous"));
    expect(html.indexOf("← Previous")).toBeLessThan(html.indexOf("Next →"));
  });
});

describe("ListToolbar", () => {
  it("supports a noun whose plural does not add s", () => {
    const html = renderToStaticMarkup(
      <ListToolbar
        count={4}
        noun="series"
        onSortChange={() => undefined}
        pluralNoun="series"
        sort="-bottles"
        sortOptions={[{ label: "Most bottles", value: "-bottles" }]}
      />,
    );

    expect(html).toContain("4 series");
    expect(html).toContain('aria-label="Sort series"');
    expect(html).not.toContain("serieses");
  });
});
