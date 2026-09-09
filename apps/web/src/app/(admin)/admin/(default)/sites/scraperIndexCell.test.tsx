import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScraperRecordCount } from "./scraperIndexCell.stylex";

describe("ScraperRecordCount", () => {
  it("keeps an empty record count quiet and accessible", () => {
    const html = renderToStaticMarkup(<ScraperRecordCount total={0} />);

    expect(html).toContain('aria-hidden="true">—');
    expect(html).toContain("None saved");
  });

  it("shows outstanding matching work", () => {
    const html = renderToStaticMarkup(
      <ScraperRecordCount total={526} unmatched={199} />,
    );

    expect(html).toContain("526");
    expect(html).toContain("199 need matching");
  });

  it("confirms when every saved record is matched", () => {
    const html = renderToStaticMarkup(
      <ScraperRecordCount total={10} unmatched={0} />,
    );

    expect(html).toContain("All matched");
  });
});
