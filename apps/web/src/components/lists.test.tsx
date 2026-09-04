import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CursorPager } from "./lists.stylex";

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
