import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { Entity } from "./entityPageData";
import { EntitySiblingOverview } from "./entitySiblingOverview";

describe("EntitySiblingOverview", () => {
  test("links to the owner company when there are no sibling entities", () => {
    const entity = {
      ...mockEntity,
      id: 1,
      ownerId: 42,
      owner: {
        id: 42,
        name: "Suntory Global Spirits",
        peatedId: "E0042",
      },
      images: [],
    } satisfies Entity;

    const html = renderToStaticMarkup(
      <EntitySiblingOverview
        entity={entity}
        error={false}
        pending={false}
        retry={() => undefined}
        siblingList={{
          rel: { nextCursor: null, prevCursor: null },
          results: [],
          total: 0,
        }}
      />,
    );

    expect(html).toContain("Also part of Suntory Global Spirits");
    expect(html).toContain('href="/entities/42"');
    expect(html).toContain("View company");
  });
});
