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
  section:
    | "brands"
    | "bottlers"
    | "distilleries"
    | "groupCompanies"
    | "portfolio",
  items?: ListItems,
  total?: number,
) {
  const kind =
    section === "brands"
      ? "brand"
      : section === "distilleries"
        ? "distillery"
        : section === "bottlers"
          ? "bottler"
          : undefined;

  return renderToStaticMarkup(
    <CompanyOwnedList
      company={company}
      error={false}
      href={
        kind ? `/companies/1-example-company/portfolio?kind=${kind}` : undefined
      }
      items={items}
      pending={false}
      retry={() => undefined}
      section={section}
      total={total}
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
      "bottlers",
      "Bottlers",
      "bottler",
      "Elixir Distillers",
      "/bottlers/2-elixir-distillers",
    ],
    [
      "groupCompanies",
      "Companies in this group",
      "company",
      "Suntory Global Spirits",
      "/companies/2-suntory-global-spirits",
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
    const html = render("bottlers", [
      {
        ...mockEntity,
        id: 2,
        kind: "bottler",
        name: "The Scotch Malt Whisky Society",
        shortName: "SMWS",
        totalBottles: 3_499,
      },
    ]);

    expect(html).toContain("Bottlers");
    expect(html).toContain("The Scotch Malt Whisky Society");
    expect(html).toContain('href="/bottlers/2-the-scotch-malt-whisky-society"');
    expect(html).toContain("Bottler · Islay, Scotland");
    expect(html).not.toContain("3,499 bottles");
  });

  test("links truncated previews to the complete filtered portfolio", () => {
    const html = render(
      "brands",
      [
        {
          ...mockEntity,
          id: 2,
          kind: "brand",
          name: "Portfolio Brand",
        },
      ],
      12,
    );

    expect(html).toContain("View all 12");
    expect(html).toContain(
      'href="/companies/1-example-company/portfolio?kind=brand"',
    );
  });

  test("keeps a failed portfolio request local to its section", () => {
    const html = renderToStaticMarkup(
      <CompanyOwnedList
        company={company}
        error
        pending={false}
        retry={() => undefined}
        section="portfolio"
      />,
    );

    expect(html).toContain("Could not load whisky portfolio");
    expect(html).toContain("Try again");
  });

  test.each([
    "brands",
    "bottlers",
    "distilleries",
    "groupCompanies",
    "portfolio",
  ] as const)("does not render an empty %s section", (section) => {
    expect(render(section, [])).toBe("");
  });
});
