import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { EntityOperatedOverview } from "./entityOperatedOverview";
import type { Entity } from "./entityPageData";

type EntityList = Outputs["entities"]["list"];

const company = {
  ...mockEntity,
  id: 1,
  images: [],
  kind: "company",
  name: "Example Company",
} satisfies Entity;

function render(operatedList?: EntityList) {
  return renderToStaticMarkup(
    <EntityOperatedOverview
      entity={company}
      error={false}
      operatedList={operatedList}
      pending={false}
      retry={() => undefined}
    />,
  );
}

describe("EntityOperatedOverview", () => {
  test("shows the brands and producers operated by a company", () => {
    const html = render({
      results: [
        {
          ...mockEntity,
          id: 2,
          kind: "bottler",
          name: "The Scotch Malt Whisky Society",
          shortName: "SMWS",
          totalBottles: 3_499,
        },
        {
          ...mockEntity,
          id: 3,
          kind: "brand",
          name: "Single Cask Nation",
          totalBottles: 24,
        },
      ],
      rel: { nextCursor: null, prevCursor: null },
      total: 2,
    });

    expect(html).toContain("Operates");
    expect(html).toContain("The Scotch Malt Whisky Society");
    expect(html).toContain('href="/bottlers/2-the-scotch-malt-whisky-society"');
    expect(html).toContain("Bottler · Islay, Scotland");
    expect(html).not.toContain("3,499 bottles");
    expect(html).toContain("Single Cask Nation");
    expect(html).toContain('href="/brands/3-single-cask-nation"');
  });

  test("does not render an empty section", () => {
    expect(
      render({
        results: [],
        rel: { nextCursor: null, prevCursor: null },
        total: 0,
      }),
    ).toBe("");
  });
});
