import type { CatalogTargetV1 } from "@peated/server/schemas";
import type { Review } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ReviewTable from "./reviewTable";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const groupTarget = {
  kind: "group",
  targetId: 41,
  group: {
    id: 7,
    fullName: "Springbank 12 Cask Strength",
    representativeBottleId: 19,
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

function makeReview(id: number, target: CatalogTargetV1 | null): Review {
  return {
    id,
    name: "Springbank review",
    rating: 91,
    url: `https://example.com/reviews/${id}`,
    target,
    createdAt: "2026-07-22T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
  };
}

describe("ReviewTable", () => {
  it("renders exact review identity", () => {
    const html = renderToStaticMarkup(
      <ReviewTable reviewList={[makeReview(1, bottleTarget)]} />,
    );

    expect(html).toContain('href="/bottles/19"');
    expect(html).toContain("Springbank 12 Cask Strength Batch 24");
    expect(html).toContain("Exact bottle");
  });

  it("uses the representative only as a generic route anchor", () => {
    const html = renderToStaticMarkup(
      <ReviewTable reviewList={[makeReview(2, groupTarget)]} />,
    );

    expect(html).toContain('href="/bottles/19/releases"');
    expect(html).toContain("Exact bottle not specified");
    expect(html).not.toContain('href="/bottles/19"');
  });

  it("renders unresolved review identity without a catalog link", () => {
    const html = renderToStaticMarkup(
      <ReviewTable reviewList={[makeReview(3, null)]} />,
    );

    expect(html).toContain("No Bottle");
    expect(html).not.toContain('href="/bottles/');
    expect(html).not.toContain("/releases");
  });
});
