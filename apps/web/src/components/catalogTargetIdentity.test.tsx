import type { CatalogTargetV1 } from "@peated/server/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CatalogTargetIdentity from "./catalogTargetIdentity";

const groupTarget = {
  kind: "group",
  targetId: 41,
  group: {
    id: 7,
    fullName: "Springbank 12 Cask Strength",
  },
} as CatalogTargetV1;

const bottleTarget = {
  kind: "bottle",
  targetId: 42,
  group: groupTarget.group,
  bottle: {
    id: 19,
    fullName: "Springbank 12 Cask Strength Batch 24",
  },
} as CatalogTargetV1;

describe("CatalogTargetIdentity", () => {
  it("links an exact target to its independently complete Bottle", () => {
    const html = renderToStaticMarkup(
      <CatalogTargetIdentity target={bottleTarget} compact />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).toContain("Exact bottle");
  });

  it("links generic identity without inventing a representative Bottle", () => {
    const html = renderToStaticMarkup(
      <CatalogTargetIdentity target={groupTarget} compact />,
    );

    expect(html).toContain('href="/bottle-groups/7"');
    expect(html).not.toContain('href="/bottles/');
    expect(html).toContain("Springbank 12 Cask Strength");
    expect(html).toContain("Exact bottle not specified");
  });
});
