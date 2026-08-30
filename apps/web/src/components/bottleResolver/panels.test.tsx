import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FallbackActions } from "./panels";

describe("FallbackActions", () => {
  it("presents an explicit create path when a matched bottle is incorrect", () => {
    const html = renderToStaticMarkup(
      <FallbackActions
        searchHref="/search"
        searchLabel="Search Bottles"
        createBottleHref="/bottles/new?pendingImageId=scan"
        createBottleLabel="Add a new bottle"
        title="Not the right bottle?"
        description="Add a new one using the details from this label."
      />,
    );

    expect(html).toContain("Not the right bottle?");
    expect(html).toContain("Add a new bottle");
    expect(html).toContain("/bottles/new?pendingImageId=scan");
    expect(html).not.toContain("Add Similar");
  });
});
