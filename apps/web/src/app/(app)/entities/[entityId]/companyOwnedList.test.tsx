import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CompanyOwnedList } from "./companyOwnedList";
import type { Entity } from "./entityPageData";

type ListItems = Outputs["entities"]["list"]["results"];

const company = {
  ...mockEntity,
  id: 1,
  images: [],
  kind: "company",
  name: "Example Company",
} satisfies Entity;

function render(
  section: "brands" | "distilleries" | "operates",
  items?: ListItems,
) {
  return renderToStaticMarkup(
    <CompanyOwnedList
      company={company}
      error={false}
      items={items}
      pending={false}
      retry={() => undefined}
      section={section}
    />,
  );
}

describe("CompanyOwnedList", () => {
  test.each([
    [
      "brands",
      "Brands",
      "brand",
      "Single Cask Nation",
      "/brands/2-single-cask-nation",
    ],
    [
      "distilleries",
      "Distilleries",
      "distillery",
      "Lagavulin",
      "/distillers/2-lagavulin",
    ],
    [
      "operates",
      "Operates",
      "bottler",
      "Elixir Distillers",
      "/bottlers/2-elixir-distillers",
    ],
  ] as const)(
    "shows the %s group with its own heading",
    (section, heading, kind, name, href) => {
      const html = render(section, [
        {
          ...mockEntity,
          id: 2,
          kind,
          name,
          totalBottles: 24,
        },
      ]);

      expect(html).toContain(heading);
      expect(html).toContain(name);
      expect(html).toContain(`href="${href}"`);
    },
  );

  test("keeps bottle counts out of owned entity rows", () => {
    const html = render("operates", [
      {
        ...mockEntity,
        id: 2,
        kind: "bottler",
        name: "The Scotch Malt Whisky Society",
        shortName: "SMWS",
        totalBottles: 3_499,
      },
    ]);

    expect(html).toContain("Operates");
    expect(html).toContain("The Scotch Malt Whisky Society");
    expect(html).toContain('href="/bottlers/2-the-scotch-malt-whisky-society"');
    expect(html).toContain("Bottler · Islay, Scotland");
    expect(html).not.toContain("3,499 bottles");
  });

  test.each(["brands", "distilleries", "operates"] as const)(
    "does not render an empty %s section",
    (section) => {
      expect(render(section, [])).toBe("");
    },
  );
});
