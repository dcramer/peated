import type { Entity } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import EntityHeader from "./entityHeader";

const EmptyIcon = () => null;

describe("EntityHeader", () => {
  test("shows one kind and the current owner", () => {
    const entity = {
      id: 9203,
      peatedId: "E9203",
      name: "Lagavulin Distillery",
      shortName: "Lagavulin",
      kind: "distillery",
      ownerId: 9202,
      owner: { id: 9202, peatedId: "E9202", name: "Diageo" },
      description: null,
      descriptionSrc: null,
      yearEstablished: 1816,
      website: null,
      country: null,
      region: null,
      address: null,
      location: null,
      totalTastings: 0,
      totalBottles: 0,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
    } satisfies Entity;

    const html = renderToStaticMarkup(
      <EntityHeader entity={entity} icon={EmptyIcon} />,
    );
    const text = html.replace(/<[^>]*>/g, "");

    expect(text).toContain("Owned by Diageo");
    expect(text).toContain("distillery");
    expect(html).toContain('href="/entities/9202"');
    expect(html).toContain('href="/distillers"');
  });
});
