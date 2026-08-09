import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DecisionBottle, formatDecision } from "./decisionRow";

describe("DecisionBottle", () => {
  it("links the independently complete Bottle", () => {
    const bottle = {
      id: 19,
      fullName: "Springbank 12 Cask Strength Batch 24",
    };
    const html = renderToStaticMarkup(<DecisionBottle bottle={bottle} />);

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
  });

  it("labels a deleted Bottle without linking it", () => {
    const html = renderToStaticMarkup(<DecisionBottle bottle={null} />);

    expect(html).toContain("Deleted Bottle");
    expect(html).not.toContain("href=");
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
