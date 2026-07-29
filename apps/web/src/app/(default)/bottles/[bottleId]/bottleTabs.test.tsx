import type { Bottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import BottleTabs from "./bottleTabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/bottles/42/releases",
}));

function bottleWithReleaseCount(totalBottles: number): Bottle {
  return {
    id: 42,
    totalTastings: 3,
    group: { totalBottles },
  } as unknown as Bottle;
}

describe("BottleTabs", () => {
  it("shows Releases instead of Similar for a release family", () => {
    const html = renderToStaticMarkup(
      <BottleTabs bottle={bottleWithReleaseCount(2)} />,
    );

    expect(html).toContain('href="/bottles/42/releases"');
    expect(html).toContain("Releases (2)");
    expect(html).not.toContain("/similar");
    expect(html).not.toContain(">Similar<");
  });

  it("hides the Releases tab for a singleton Bottle", () => {
    const html = renderToStaticMarkup(
      <BottleTabs bottle={bottleWithReleaseCount(1)} />,
    );

    expect(html).not.toContain("/releases");
    expect(html).not.toContain("Releases");
    expect(html).not.toContain("Similar");
  });
});
