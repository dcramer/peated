import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { EntityCatalogRelationships } from "./entityCatalogRelationships";
import type { Entity } from "./entityPageData";

type EntityCatalog = Outputs["entities"]["catalog"];

const baseCatalog: EntityCatalog = {
  totalBottles: 1,
  relationships: { brand: 0, bottler: 0, distiller: 1 },
  distilleryCoverage: { documented: 1, total: 1 },
  categories: [],
  related: { brands: [], bottlers: [], distillers: [] },
  notableBottles: [],
};

function renderRelationships(
  kind: Entity["kind"],
  related: EntityCatalog["related"],
  state: {
    error?: boolean;
    pending?: boolean;
    withCatalog?: boolean;
  } = {},
) {
  const entity = {
    ...mockEntity,
    id: 1,
    images: [],
    kind,
    name: "Example",
  } satisfies Entity;

  return renderToStaticMarkup(
    <EntityCatalogRelationships
      catalog={
        state.withCatalog === false ? undefined : { ...baseCatalog, related }
      }
      entity={entity}
      error={state.error ?? false}
      pending={state.pending ?? false}
      retry={() => undefined}
    />,
  );
}

describe("EntityCatalogRelationships", () => {
  test("shows bottlers on a distillery page and does not show brands", () => {
    const html = renderRelationships("distillery", {
      brands: [
        {
          id: 2,
          name: "Unused Brand",
          shortName: null,
          kind: "brand",
          count: 2,
        },
      ],
      bottlers: [
        {
          id: 3,
          name: "The Scotch Malt Whisky Society",
          shortName: "SMWS",
          kind: "bottler",
          count: 20,
        },
      ],
      distillers: [],
    });

    expect(html).toContain("Bottled by");
    expect(html).toContain("The Scotch Malt Whisky Society");
    expect(html).not.toContain("Unused Brand");
    expect(html).not.toContain(">Brands<");
  });

  test.each([
    ["brand", "Distilled at"],
    ["bottler", "Distilleries"],
  ] as const)("shows distilleries on a %s page", (kind, heading) => {
    const html = renderRelationships(kind, {
      brands: [],
      bottlers: [],
      distillers: [
        {
          id: 4,
          name: "Caol Ila",
          shortName: null,
          kind: "distillery",
          count: 5,
        },
      ],
    });

    expect(html).toContain(heading);
    expect(html).toContain("Caol Ila");
  });

  test("shows bottlers on a brand page when no distillery is known", () => {
    const html = renderRelationships("brand", {
      brands: [],
      bottlers: [
        {
          id: 5,
          name: "Independent Bottler",
          shortName: null,
          kind: "bottler",
          count: 3,
        },
      ],
      distillers: [],
    });

    expect(html).toContain("Bottled by");
    expect(html).toContain("Independent Bottler");
  });

  test.each([
    ["loading", { pending: true }, "Loading distilleries and bottlers"],
    ["error", { error: true }, "Could not load distilleries and bottlers"],
  ] as const)(
    "uses a neutral heading for a brand %s state without catalog data",
    (_state, options, message) => {
      const html = renderRelationships(
        "brand",
        { brands: [], bottlers: [], distillers: [] },
        { ...options, withCatalog: false },
      );

      expect(html).toContain("Distilleries and bottlers");
      expect(html).toContain(message);
    },
  );

  test("uses the known brand fallback in an error state", () => {
    const html = renderRelationships(
      "brand",
      {
        brands: [],
        bottlers: [
          {
            id: 5,
            name: "Independent Bottler",
            shortName: null,
            kind: "bottler",
            count: 3,
          },
        ],
        distillers: [],
      },
      { error: true },
    );

    expect(html).toContain("Bottled by");
    expect(html).toContain("Could not load bottlers");
    expect(html).not.toContain("Distilled at");
  });
});
