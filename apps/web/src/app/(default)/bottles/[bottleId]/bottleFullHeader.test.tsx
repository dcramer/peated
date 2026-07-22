import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BottleRelationshipLinks } from "./bottleFullHeader";

function bottleWithGroup(totalBottles: number) {
  return {
    id: 42,
    group: {
      id: 7,
      totalBottles,
    },
  };
}

describe("BottleRelationshipLinks", () => {
  it("links a multi-Bottle group without using it as the Bottle label", () => {
    const html = renderToStaticMarkup(
      <BottleRelationshipLinks bottle={bottleWithGroup(3)} />,
    );

    expect(html).toContain('href="/bottle-groups/7"');
    expect(html).toContain("View all 3 releases");
    expect(html).toContain('href="/bottles/42/addRelease"');
    expect(html).toContain("Add another release");
  });

  it("does not advertise a related-release list for a singleton group", () => {
    const html = renderToStaticMarkup(
      <BottleRelationshipLinks bottle={bottleWithGroup(1)} />,
    );

    expect(html).not.toContain("View all");
    expect(html).not.toContain("/bottle-groups/");
    expect(html).toContain('href="/bottles/42/addRelease"');
  });
});
