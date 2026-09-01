import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { EntityDetails } from "./entityDetails.stylex";
import type { Entity } from "./entityPageData";

describe("EntityDetails", () => {
  test("links an owner to its canonical public route", () => {
    const entity = {
      ...mockEntity,
      images: [],
      ownerId: 2,
      owner: {
        id: 2,
        kind: "company",
        name: "Example Company",
        peatedId: "E0002",
      },
    } satisfies Entity;

    const html = renderToStaticMarkup(<EntityDetails entity={entity} />);

    expect(html).toContain('href="/companies/2"');
    expect(html).not.toContain('href="/entities/2"');
  });
});
