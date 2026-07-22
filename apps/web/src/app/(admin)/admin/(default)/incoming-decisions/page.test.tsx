import type { CatalogTargetV1 } from "@peated/server/schemas";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DecisionTarget, formatDecision } from "./decisionRow";

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

describe("DecisionTarget", () => {
  it("links an exact target to its independently complete Bottle", () => {
    const html = renderToStaticMarkup(<DecisionTarget target={bottleTarget} />);

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).toContain("Exact bottle");
  });

  it("links a generic target to its group without inventing a Bottle link", () => {
    const html = renderToStaticMarkup(<DecisionTarget target={groupTarget} />);

    expect(html).toContain('href="/bottle-groups/7"');
    expect(html).not.toContain('href="/bottles/');
    expect(html).toContain("Springbank 12 Cask Strength");
    expect(html).toContain("Exact bottle not specified");
  });

  it("renders a user-readable state when no target was retained", () => {
    const html = renderToStaticMarkup(<DecisionTarget target={null} />);

    expect(html).toContain("Unknown target");
    expect(html).not.toContain("<a");
  });
});

describe("formatDecision", () => {
  it.each([
    ["create_release", "Created Release"],
    ["create_bottle_and_release", "Created Bottle + Release"],
  ] as const)("preserves the historical %s label", (decision, label) => {
    expect(formatDecision(decision)).toBe(label);
  });
});
